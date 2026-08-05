import "server-only";

import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  broadcastDeliveries,
  broadcasts,
  notifications,
  users,
} from "@/db/schema";

import { describeAudience, resolveAudience, type Audience } from "./audience";
import { sendDiscordWebhook } from "./discord";
import { normalizePhone, sendWhatsApp } from "./zaia";

/**
 * Avisos do RH — criação e fan-out.
 *
 * Dois canais no v1: Discord (canal público, via webhook) e WhatsApp (Zaia, um
 * envio por pessoa). O enum `channel` já aceita `email` para quando o envio de
 * e-mail voltar do roadmap — nada muda no schema nesse dia.
 *
 * A notificação in-app é SEMPRE criada, independente dos canais escolhidos: é a
 * própria intranet, não um canal externo que possa estar fora do ar.
 */

export type Channel = "discord" | "whatsapp";

export type SendResult =
  | {
      ok: true;
      id: string;
      recipients: number;
      sent: number;
      failed: number;
      skipped: number;
    }
  | { ok: false; error: string };

export async function createAndSendBroadcast(params: {
  title: string;
  body: string;
  audience: Audience;
  channels: Channel[];
  createdBy: string;
}): Promise<SendResult> {
  const title = params.title.trim();
  const body = params.body.trim();

  if (!title) return { ok: false, error: "Informe o título do aviso." };
  if (!body) return { ok: false, error: "Escreva o conteúdo do aviso." };

  const recipients = await resolveAudience(params.audience);
  if (recipients.length === 0) {
    return {
      ok: false,
      error: "Nenhum colaborador ativo se encaixa nessa audiência.",
    };
  }

  const [broadcast] = await db
    .insert(broadcasts)
    .values({
      title,
      body,
      audienceType: params.audience.type,
      audienceValue: params.audience.value,
      channels: params.channels,
      createdBy: params.createdBy,
    })
    .returning({ id: broadcasts.id });

  // In-app sempre — é a própria intranet, não depende de canal externo.
  await db.insert(notifications).values(
    recipients.map((r) => ({
      userId: r.id,
      title,
      body,
      link: "/avisos",
    })),
  );

  type DeliveryRow = typeof broadcastDeliveries.$inferInsert;
  const deliveries: DeliveryRow[] = [];

  /* --- Discord: UMA entrega, para o canal ------------------------- */
  if (params.channels.includes("discord")) {
    const result = await sendDiscordWebhook({
      title,
      body: `${body}\n\n_${describeAudience(params.audience)} · ${recipients.length} pessoa(s)_`,
    });

    deliveries.push({
      broadcastId: broadcast.id,
      // NULL de propósito: é entrega de canal, não de pessoa.
      userId: null,
      channel: "discord",
      status: result.ok ? "sent" : result.skipped ? "skipped" : "failed",
      errorMessage: result.ok
        ? null
        : result.skipped
          ? result.reason
          : result.error,
      sentAt: result.ok ? new Date() : null,
    });
  }

  /* --- WhatsApp: uma entrega POR PESSOA --------------------------- */
  if (params.channels.includes("whatsapp")) {
    // `allSettled` para que um número inválido não derrube os outros envios.
    const results = await Promise.allSettled(
      recipients.map(async (r) => {
        const phone = normalizePhone(r.phone);
        if (!phone) {
          return {
            userId: r.id,
            status: "skipped" as const,
            error: "sem telefone válido no cadastro",
          };
        }

        const sent = await sendWhatsApp({
          phone,
          name: r.name.split(" ")[0],
          message: `${title}\n\n${body}`,
        });

        if (sent.ok) return { userId: r.id, status: "sent" as const, error: null };
        return {
          userId: r.id,
          status: sent.skipped ? ("skipped" as const) : ("failed" as const),
          error: sent.skipped ? sent.reason : sent.error,
        };
      }),
    );

    results.forEach((outcome, index) => {
      if (outcome.status === "fulfilled") {
        deliveries.push({
          broadcastId: broadcast.id,
          userId: outcome.value.userId,
          channel: "whatsapp",
          status: outcome.value.status,
          errorMessage: outcome.value.error,
          sentAt: outcome.value.status === "sent" ? new Date() : null,
        });
      } else {
        deliveries.push({
          broadcastId: broadcast.id,
          userId: recipients[index].id,
          channel: "whatsapp",
          status: "failed",
          errorMessage: String(outcome.reason).slice(0, 500),
          sentAt: null,
        });
      }
    });
  }

  if (deliveries.length > 0) {
    await db.insert(broadcastDeliveries).values(deliveries);
  }

  const count = (status: string) =>
    deliveries.filter((d) => d.status === status).length;

  return {
    ok: true,
    id: broadcast.id,
    recipients: recipients.length,
    sent: count("sent"),
    failed: count("failed"),
    skipped: count("skipped"),
  };
}

/* ------------------------------------------------------------------ */
/* Histórico                                                           */
/* ------------------------------------------------------------------ */

export async function listBroadcasts() {
  const rows = await db
    .select({
      id: broadcasts.id,
      title: broadcasts.title,
      body: broadcasts.body,
      audienceType: broadcasts.audienceType,
      audienceValue: broadcasts.audienceValue,
      channels: broadcasts.channels,
      createdAt: broadcasts.createdAt,
      authorName: users.name,
    })
    .from(broadcasts)
    .innerJoin(users, eq(users.id, broadcasts.createdBy))
    .orderBy(desc(broadcasts.createdAt));

  const stats = await db
    .select({
      broadcastId: broadcastDeliveries.broadcastId,
      channel: broadcastDeliveries.channel,
      status: broadcastDeliveries.status,
      total: sql<number>`count(*)::int`,
    })
    .from(broadcastDeliveries)
    .groupBy(
      broadcastDeliveries.broadcastId,
      broadcastDeliveries.channel,
      broadcastDeliveries.status,
    );

  return rows.map((row) => ({
    ...row,
    deliveries: stats.filter((s) => s.broadcastId === row.id),
  }));
}

export async function getBroadcastDeliveries(broadcastId: string) {
  return db
    .select({
      id: broadcastDeliveries.id,
      channel: broadcastDeliveries.channel,
      status: broadcastDeliveries.status,
      errorMessage: broadcastDeliveries.errorMessage,
      sentAt: broadcastDeliveries.sentAt,
      recipientName: users.name,
    })
    .from(broadcastDeliveries)
    .leftJoin(users, eq(users.id, broadcastDeliveries.userId))
    .where(eq(broadcastDeliveries.broadcastId, broadcastId))
    .orderBy(broadcastDeliveries.channel, users.name);
}
