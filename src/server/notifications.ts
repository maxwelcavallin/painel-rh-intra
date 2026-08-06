import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { notificationSettings, notifications, users } from "@/db/schema";
import type { Channel, NotificationType } from "@/db/schema";

import { sendDiscordDirect } from "./discord";
import { normalizePhone, sendZaia, type ZaiaTemplate } from "./zaia";

/**
 * Central de comunicações INDIVIDUAIS.
 *
 * Um único ponto por onde passa toda notificação dirigida a uma pessoa. O RH
 * liga e desliga cada tipo por canal na tela de Comunicações; este módulo
 * respeita essa matriz e mais nada decide sozinho.
 *
 * Aviso em GRUPO (broadcast) não passa por aqui — tem audiência, histórico e
 * regras próprias, em `broadcasts.ts`.
 *
 * A notificação dentro da intranet é SEMPRE criada, independente da matriz: ela
 * é o próprio sistema, não um canal externo que possa estar fora do ar ou
 * incomodar alguém fora do horário.
 */

/* ------------------------------------------------------------------ */
/* Catálogo                                                            */
/* ------------------------------------------------------------------ */

export type NotificationMeta = {
  type: NotificationType;
  label: string;
  description: string;
  /** Quem recebe — texto para a tela de configuração. */
  audience: string;
  zaiaTemplate: ZaiaTemplate;
};

/**
 * Fonte única da verdade sobre os tipos. A tela de Comunicações se monta a
 * partir daqui, então tipo novo aparece na UI sem mexer em componente.
 */
export const NOTIFICATION_CATALOG: NotificationMeta[] = [
  {
    type: "password_reset",
    label: "Código de recuperação de senha",
    description: "Código de 6 dígitos para redefinir a senha de acesso.",
    audience: "Quem pediu a recuperação",
    zaiaTemplate: "password_reset",
  },
  {
    type: "vacation_request",
    label: "Nova solicitação de férias",
    description: "Avisa que alguém da equipe pediu férias e aguarda decisão.",
    audience: "Gestor direto",
    zaiaTemplate: "vacation_request",
  },
  {
    type: "vacation_decision",
    label: "Decisão sobre férias",
    description: "Resultado da solicitação — aprovada ou reprovada.",
    audience: "Colaborador solicitante",
    zaiaTemplate: "vacation_decision",
  },
  {
    type: "vacation_expiring",
    label: "Período aquisitivo vencendo",
    description:
      "Alerta de férias que precisam ser concedidas antes de virar pagamento em dobro.",
    audience: "Colaborador, gestor e RH",
    zaiaTemplate: "vacation_expiring",
  },
  {
    type: "vacation_receipt",
    label: "Recibo de férias pendente",
    description: "Cobra a assinatura do recibo antes do início das férias.",
    audience: "Colaborador e RH",
    zaiaTemplate: "vacation_receipt",
  },
  {
    type: "vacation_payment",
    label: "Pagamento de férias a vencer",
    description:
      "Alerta do prazo do art. 145 — pagamento até 2 dias úteis antes do início.",
    audience: "RH",
    zaiaTemplate: "vacation_payment",
  },
  {
    type: "form_new",
    label: "Novo formulário publicado",
    description: "Avisa que há um formulário aguardando resposta.",
    audience: "Audiência do formulário",
    zaiaTemplate: "form_new",
  },
  {
    type: "form_reminder",
    label: "Cobrança de formulário",
    description: "Lista consolidada de quem da equipe ainda não respondeu.",
    audience: "Gestor direto",
    zaiaTemplate: "form_reminder",
  },
];

export const CONFIGURABLE_CHANNELS: Channel[] = ["whatsapp", "discord", "email"];

export const CHANNEL_META: Record<
  Channel,
  { label: string; hint: string; available: boolean }
> = {
  whatsapp: {
    label: "WhatsApp",
    hint: "Via Zaia, no número do cadastro. Cada tipo usa seu próprio template.",
    available: true,
  },
  discord: {
    label: "Discord",
    hint: "Mensagem privada. Exige bot e o ID numérico da pessoa — no roadmap.",
    available: false,
  },
  email: {
    label: "E-mail",
    hint: "Ainda não implementado. Na demonstração, o WhatsApp faz esse papel.",
    available: false,
  },
};

/* ------------------------------------------------------------------ */
/* Leitura e escrita da matriz                                         */
/* ------------------------------------------------------------------ */

export type SettingsMatrix = Record<string, boolean>;

const key = (type: NotificationType, channel: Channel) => `${type}:${channel}`;

export async function getSettingsMatrix(): Promise<SettingsMatrix> {
  const rows = await db.select().from(notificationSettings);
  const matrix: SettingsMatrix = {};
  for (const row of rows) matrix[key(row.type, row.channel)] = row.enabled;
  return matrix;
}

export async function setChannelEnabled(params: {
  type: NotificationType;
  channel: Channel;
  enabled: boolean;
  updatedBy: string;
}): Promise<void> {
  await db
    .insert(notificationSettings)
    .values({
      type: params.type,
      channel: params.channel,
      enabled: params.enabled,
      updatedBy: params.updatedBy,
    })
    .onConflictDoUpdate({
      target: [notificationSettings.type, notificationSettings.channel],
      set: {
        enabled: params.enabled,
        updatedBy: params.updatedBy,
        updatedAt: new Date(),
      },
    });
}

export async function isEnabled(
  type: NotificationType,
  channel: Channel,
): Promise<boolean> {
  const [row] = await db
    .select({ enabled: notificationSettings.enabled })
    .from(notificationSettings)
    .where(
      and(
        eq(notificationSettings.type, type),
        eq(notificationSettings.channel, channel),
      ),
    )
    .limit(1);

  // Linha ausente = desligado. O padrão é não incomodar.
  return row?.enabled ?? false;
}

/* ------------------------------------------------------------------ */
/* Envio                                                               */
/* ------------------------------------------------------------------ */

export type DispatchOutcome = {
  inApp: boolean;
  channels: { channel: Channel; status: "sent" | "failed" | "skipped"; detail?: string }[];
};

/**
 * Notifica UMA pessoa, respeitando a matriz do RH.
 *
 * Nunca lança: notificação que falha não pode desfazer a operação que já foi
 * gravada — férias aprovada continua aprovada mesmo se o WhatsApp cair.
 */
export async function notify(params: {
  type: NotificationType;
  userId: string;
  title: string;
  message: string;
  link?: string;
  /** Campos extras do template (ex.: `codigo` na recuperação de senha). */
  extra?: Record<string, string>;
}): Promise<DispatchOutcome> {
  const outcome: DispatchOutcome = { inApp: false, channels: [] };

  const meta = NOTIFICATION_CATALOG.find((n) => n.type === params.type);
  if (!meta) {
    console.error(`[notify] tipo desconhecido: ${params.type}`);
    return outcome;
  }

  const [person] = await db
    .select({
      name: users.name,
      phone: users.phone,
      discordUserId: users.discordUserId,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.id, params.userId))
    .limit(1);

  if (!person || !person.isActive) return outcome;

  // 1. In-app — sempre.
  try {
    await db.insert(notifications).values({
      userId: params.userId,
      title: params.title,
      body: params.message,
      link: params.link ?? null,
    });
    outcome.inApp = true;
  } catch (error) {
    console.error("[notify] falha ao gravar notificação in-app:", error);
  }

  const firstName = person.name.split(" ")[0];

  // Carrega a matriz de canais deste tipo em UMA query — antes fazíamos uma
  // por canal, o que virava N+1 no envio em lote (`vacation-alerts.ts`).
  const settingsRows = await db
    .select({
      channel: notificationSettings.channel,
      enabled: notificationSettings.enabled,
    })
    .from(notificationSettings)
    .where(eq(notificationSettings.type, params.type));
  const channelEnabled: Partial<Record<Channel, boolean>> = {};
  for (const row of settingsRows) channelEnabled[row.channel] = row.enabled;

  // 2. Canais externos — só os que o RH ligou para este tipo.
  for (const channel of CONFIGURABLE_CHANNELS) {
    if (!channelEnabled[channel]) continue;

    if (channel === "email") {
      // Fora de escopo do v1 por decisão de produto: na demonstração o
      // WhatsApp cobre o papel do e-mail. Registrado, não silencioso.
      outcome.channels.push({
        channel,
        status: "skipped",
        detail: "canal de e-mail ainda não implementado",
      });
      continue;
    }

    if (channel === "whatsapp") {
      const phone = normalizePhone(person.phone);
      if (!phone) {
        outcome.channels.push({
          channel,
          status: "skipped",
          detail: "sem telefone válido no cadastro",
        });
        continue;
      }
      const result = await sendZaia({
        template: meta.zaiaTemplate,
        phone,
        name: firstName,
        message: params.message,
        extra: params.extra,
      });
      outcome.channels.push({
        channel,
        status: result.ok ? "sent" : result.skipped ? "skipped" : "failed",
        detail: result.ok ? undefined : result.skipped ? result.reason : result.error,
      });
      continue;
    }

    if (channel === "discord") {
      const result = await sendDiscordDirect({
        discordUserId: person.discordUserId,
        title: params.title,
        body: params.message,
      });
      outcome.channels.push({
        channel,
        status: result.ok ? "sent" : result.skipped ? "skipped" : "failed",
        detail: result.ok ? undefined : result.skipped ? result.reason : result.error,
      });
    }
  }

  const falhas = outcome.channels.filter((c) => c.status !== "sent");
  if (falhas.length > 0) {
    console.warn(
      `[notify] ${params.type} → ${params.userId}: ` +
        falhas.map((f) => `${f.channel}=${f.status} (${f.detail})`).join(", "),
    );
  }

  return outcome;
}

/** Notifica várias pessoas com a mesma mensagem. Uma falha não trava as outras. */
export async function notifyMany(params: {
  type: NotificationType;
  userIds: string[];
  title: string;
  message: string;
  link?: string;
  /** Campos extras do template, iguais para todo mundo do lote. */
  extra?: Record<string, string>;
}): Promise<void> {
  await Promise.allSettled(
    params.userIds.map((userId) => notify({ ...params, userId })),
  );
}
