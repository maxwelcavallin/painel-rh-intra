import "server-only";

import { and, eq, or } from "drizzle-orm";

import { db } from "@/db";
import { notifications, users } from "@/db/schema";

import { normalizePhone, sendWhatsApp } from "./zaia";

/**
 * Canais de notificação do v1: in-app (RH/gestor) e WhatsApp via Zaia
 * (colaborador). Sem e-mail — ver roadmap.
 *
 * Nenhuma função aqui lança: notificação que falha não pode desfazer uma
 * decisão de férias que já foi gravada.
 */

export async function notifyInApp(params: {
  userIds: string[];
  title: string;
  body: string;
  link?: string;
}): Promise<void> {
  if (params.userIds.length === 0) return;

  try {
    await db.insert(notifications).values(
      params.userIds.map((userId) => ({
        userId,
        title: params.title,
        body: params.body,
        link: params.link ?? null,
      })),
    );
  } catch (error) {
    console.error("[notify] falha ao gravar notificação in-app:", error);
  }
}

/** Manda WhatsApp para uma pessoa específica, buscando o telefone do cadastro. */
export async function notifyWhatsApp(params: {
  userId: string;
  message: string;
}): Promise<void> {
  try {
    const [user] = await db
      .select({ name: users.name, phone: users.phone })
      .from(users)
      .where(eq(users.id, params.userId))
      .limit(1);

    const phone = normalizePhone(user?.phone);
    if (!user || !phone) {
      console.warn(
        `[notify] usuário ${params.userId} sem telefone válido; WhatsApp ignorado.`,
      );
      return;
    }

    const result = await sendWhatsApp({
      phone,
      name: user.name.split(" ")[0],
      message: params.message,
    });

    if (!result.ok) {
      const reason = result.skipped ? result.reason : result.error;
      console.error(`[notify] WhatsApp falhou para ${params.userId}: ${reason}`);
    }
  } catch (error) {
    console.error("[notify] erro inesperado no WhatsApp:", error);
  }
}

/**
 * Avisa o GESTOR DIRETO por canal privado.
 *
 * Privado de propósito — solicitação de férias é nominal e não é aviso público,
 * então não vai para o canal do webhook do Discord.
 *
 * Hoje só WhatsApp. DM no Discord ficou no roadmap pós-entrega: webhook não faz
 * mensagem privada, precisaria de um bot com token próprio e do ID numérico de
 * cada pessoa. O campo `users.discordUserId` já existe para quando isso voltar.
 */
export async function notifyManagerPrivately(params: {
  managerId: string;
  message: string;
}): Promise<void> {
  await notifyWhatsApp({ userId: params.managerId, message: params.message });
}

/** Quem precisa saber que existe uma solicitação: o RH inteiro + o gestor direto. */
export async function approversFor(userId: string): Promise<string[]> {
  const [employee] = await db
    .select({ managerId: users.managerId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.isActive, true),
        employee?.managerId
          ? or(eq(users.role, "admin"), eq(users.id, employee.managerId))
          : eq(users.role, "admin"),
      ),
    );

  return rows.map((r) => r.id).filter((id) => id !== userId);
}
