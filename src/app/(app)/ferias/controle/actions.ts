"use server";

import { revalidatePath } from "next/cache";

import { requireRH } from "@/lib/dal";
import {
  markReportedToSenior,
  registerPayment,
  registerReceiptSigned,
} from "@/server/vacations";

export type ControlState = { error?: string; ok?: string };

export async function registerReceiptAction(formData: FormData): Promise<void> {
  const rh = await requireRH();
  const id = String(formData.get("requestId") ?? "");
  if (!id) return;

  await registerReceiptSigned({ requestId: id, rhId: rh.id });
  revalidatePath("/ferias/controle");
}

export async function registerPaymentAction(formData: FormData): Promise<void> {
  const rh = await requireRH();
  const id = String(formData.get("requestId") ?? "");
  if (!id) return;

  await registerPayment({ requestId: id, rhId: rh.id });
  revalidatePath("/ferias/controle");
}

/**
 * Marca o lote como repassado à Senior.
 *
 * O RH exporta o CSV e confirma o envio; a partir daí a linha some da fila de
 * pendências de repasse, que é o que hoje se controla de cabeça nos dias 10 e 20.
 */
export async function markReportedAction(formData: FormData): Promise<void> {
  await requireRH();

  const ids = String(formData.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  await markReportedToSenior(ids);
  revalidatePath("/ferias/controle");
}
