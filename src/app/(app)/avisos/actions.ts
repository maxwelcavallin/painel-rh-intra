"use server";

import { revalidatePath } from "next/cache";

import { requireRH } from "@/lib/dal";
import { resolveAudience, type Audience } from "@/server/audience";
import { createAndSendBroadcast, type Channel } from "@/server/broadcasts";

export type BroadcastState = {
  error?: string;
  result?: { recipients: number; sent: number; failed: number; skipped: number };
};

function readAudience(formData: FormData): Audience {
  const type = String(formData.get("audienceType") ?? "all") as Audience["type"];
  const raw = String(formData.get("audienceValue") ?? "").trim();
  return { type, value: type === "all" ? null : raw || null };
}

export async function sendBroadcastAction(
  _prev: BroadcastState,
  formData: FormData,
): Promise<BroadcastState> {
  // Só o RH dispara aviso para a empresa.
  const rh = await requireRH();

  const channels: Channel[] = [];
  if (formData.get("channelDiscord") === "on") channels.push("discord");
  if (formData.get("channelWhatsapp") === "on") channels.push("whatsapp");

  const result = await createAndSendBroadcast({
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
    audience: readAudience(formData),
    channels,
    createdBy: rh.id,
  });

  if (!result.ok) return { error: result.error };

  revalidatePath("/avisos");

  return {
    result: {
      recipients: result.recipients,
      sent: result.sent,
      failed: result.failed,
      skipped: result.skipped,
    },
  };
}

/** Prévia de quantas pessoas a audiência atinge, antes de enviar. */
export async function previewAudienceAction(
  audience: Audience,
): Promise<{ count: number; names: string[] }> {
  await requireRH();

  const recipients = await resolveAudience(audience);
  return {
    count: recipients.length,
    names: recipients.slice(0, 8).map((r): string => r.name),
  };
}
