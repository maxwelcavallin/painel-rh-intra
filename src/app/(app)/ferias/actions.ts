"use server";

import { revalidatePath } from "next/cache";

import { requireManagerOrRH, requireSession } from "@/lib/dal";
import {
  cancelVacationRequest,
  createVacationRequest,
  decideVacationRequest,
} from "@/server/vacations";

export type RequestState = {
  error?: string;
  success?: { status: string; reasoning: string };
};

export async function submitVacationRequestAction(
  _prev: RequestState,
  formData: FormData,
): Promise<RequestState> {
  // Identidade vem da sessão, NUNCA do formulário. Era exatamente a brecha do
  // /solicitar público: qualquer um digitava o nome de outra pessoa.
  const user = await requireSession();

  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();
  const abonoDays = Number(formData.get("abonoDays") ?? 0);
  const advance13th = formData.get("advance13th") === "on";

  if (!startDate || !endDate) {
    return { error: "Informe a data de início e a de término." };
  }
  if (!Number.isFinite(abonoDays) || abonoDays < 0) {
    return { error: "Dias de abono inválidos." };
  }

  const result = await createVacationRequest({
    userId: user.id,
    startDate,
    endDate,
    abonoDays: Math.round(abonoDays),
    advance13th,
    notes: notes || null,
  });

  if (!result.ok) return { error: result.error };

  revalidatePath("/ferias/minhas");
  revalidatePath("/aprovacoes");

  return { success: { status: result.status, reasoning: result.reasoning } };
}

export type DecideState = { error?: string; ok?: boolean };

export async function decideVacationAction(
  _prev: DecideState,
  formData: FormData,
): Promise<DecideState> {
  // Papel checado aqui de novo; o escopo por gestor é reforçado no serviço.
  const approver = await requireManagerOrRH();

  const requestId = String(formData.get("requestId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (decision !== "approved" && decision !== "rejected") {
    return { error: "Decisão inválida." };
  }
  if (!requestId) return { error: "Solicitação não informada." };

  const result = await decideVacationRequest({
    requestId,
    decider: { id: approver.id, role: approver.role },
    decision,
    note: note || null,
  });

  if (!result.ok) return { error: result.error };

  revalidatePath("/aprovacoes");
  revalidatePath("/ferias/minhas");
  revalidatePath("/calendario");

  return { ok: true };
}

export async function cancelVacationAction(
  _prev: DecideState,
  formData: FormData,
): Promise<DecideState> {
  // Colaborador cancela a própria; o serviço checa a posse e o papel.
  const user = await requireSession();

  const requestId = String(formData.get("requestId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!requestId) return { error: "Solicitação não informada." };

  const result = await cancelVacationRequest({
    requestId,
    actor: { id: user.id, role: user.role },
    reason: reason || null,
  });

  if (!result.ok) return { error: result.error };

  revalidatePath("/ferias/minhas");
  revalidatePath("/aprovacoes");
  revalidatePath("/calendario");
  revalidatePath("/ferias/controle");

  return { ok: true };
}
