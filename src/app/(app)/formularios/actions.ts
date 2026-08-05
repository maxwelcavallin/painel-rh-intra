"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { FormQuestion } from "@/db/schema";
import { requireRH, requireSession } from "@/lib/dal";
import type { Audience } from "@/server/audience";
import {
  closeForm,
  createForm,
  reopenForm,
  sendPendingReminders,
  submitResponse,
} from "@/server/forms";

export type FormState = { error?: string };

export async function createFormAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const rh = await requireRH();

  let questions: FormQuestion[];
  try {
    questions = JSON.parse(String(formData.get("questions") ?? "[]"));
  } catch {
    return { error: "Perguntas em formato inválido." };
  }

  const type = String(formData.get("audienceType") ?? "all") as Audience["type"];
  const rawValue = String(formData.get("audienceValue") ?? "").trim();

  const hours = Number(formData.get("reminderAfterHours") ?? 48);
  if (!Number.isFinite(hours) || hours < 1) {
    return { error: "O prazo de lembrete precisa ser de ao menos 1 hora." };
  }

  const result = await createForm({
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    questions,
    audience: { type, value: type === "all" ? null : rawValue || null },
    reminderAfterHours: Math.round(hours),
    createdBy: rh.id,
  });

  if (!result.ok) return { error: result.error };

  revalidatePath("/formularios");
  revalidatePath("/formularios/painel");
  redirect(`/formularios/painel?criado=1`);
}

export type AnswerState = { error?: string; ok?: boolean };

export async function submitResponseAction(
  _prev: AnswerState,
  formData: FormData,
): Promise<AnswerState> {
  // Identidade da sessão — nunca do formulário.
  const user = await requireSession();

  const formId = String(formData.get("formId") ?? "");
  if (!formId) return { error: "Formulário não informado." };

  let answers: Record<string, unknown>;
  try {
    answers = JSON.parse(String(formData.get("answers") ?? "{}"));
  } catch {
    return { error: "Respostas em formato inválido." };
  }

  const result = await submitResponse({ formId, userId: user.id, answers });
  if (!result.ok) return { error: result.error };

  revalidatePath("/formularios");
  revalidatePath("/formularios/painel");
  return { ok: true };
}

export async function toggleFormAction(formData: FormData): Promise<void> {
  await requireRH();

  const id = String(formData.get("formId") ?? "");
  const shouldClose = formData.get("close") === "1";
  if (!id) return;

  if (shouldClose) await closeForm(id);
  else await reopenForm(id);

  revalidatePath("/formularios/painel");
  revalidatePath(`/formularios/painel/${id}`);
}

/**
 * Dispara a cobrança dos pendentes na hora.
 *
 * Existe porque o plano Hobby da Vercel só permite UMA execução de cron por dia.
 * Chama exatamente a mesma função do cron — mesma regra de anti-recobrança, mesmo
 * agrupamento por gestor. Só o RH pode acionar.
 */
export async function runRemindersNowAction(): Promise<void> {
  await requireRH();

  const report = await sendPendingReminders();
  console.log(
    `[lembretes-manual] ${report.formsOverdue} formulário(s) vencido(s), ` +
      `${report.managersNotified} gestor(es) avisado(s).`,
  );

  revalidatePath("/formularios/painel");
}
