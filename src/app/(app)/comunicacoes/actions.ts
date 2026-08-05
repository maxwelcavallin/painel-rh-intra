"use server";

import { revalidatePath } from "next/cache";

import type { Channel, NotificationType } from "@/db/schema";
import { requireRH } from "@/lib/dal";
import { notify, setChannelEnabled } from "@/server/notifications";

export type ChannelState = { error?: string; ok?: string };

export async function toggleChannelAction(formData: FormData): Promise<void> {
  const rh = await requireRH();

  const type = String(formData.get("type") ?? "") as NotificationType;
  const channel = String(formData.get("channel") ?? "") as Channel;
  const enabled = String(formData.get("enabled") ?? "") === "1";

  if (!type || !channel) return;

  await setChannelEnabled({ type, channel, enabled, updatedBy: rh.id });
  revalidatePath("/comunicacoes");
}

/**
 * Envia uma mensagem de teste para o próprio RH, pelo tipo escolhido.
 *
 * Serve para conferir se o webhook daquele template está certo ANTES de a
 * primeira mensagem real sair errada para a empresa toda.
 */
export async function sendTestAction(
  _prev: ChannelState,
  formData: FormData,
): Promise<ChannelState> {
  const rh = await requireRH();
  const type = String(formData.get("type") ?? "") as NotificationType;
  if (!type) return { error: "Tipo não informado." };

  const outcome = await notify({
    type,
    userId: rh.id,
    title: "Teste de comunicação",
    message:
      `Esta é uma mensagem de teste do tipo "${type}", disparada por você na ` +
      `Intranet RH. Se chegou, o canal está configurado corretamente.`,
    link: "/comunicacoes",
  });

  const externos = outcome.channels;
  if (externos.length === 0) {
    return {
      ok: "Nenhum canal externo está ligado para este tipo — só a notificação dentro da intranet foi criada.",
    };
  }

  const resumo = externos
    .map((c) => `${c.channel}: ${c.status}${c.detail ? ` (${c.detail})` : ""}`)
    .join(" · ");

  return externos.every((c) => c.status === "sent")
    ? { ok: `Enviado. ${resumo}` }
    : { error: `Nem tudo saiu. ${resumo}` };
}
