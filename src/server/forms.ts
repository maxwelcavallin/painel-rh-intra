import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { formResponses, forms, notifications, users } from "@/db/schema";
import type { FormQuestion, Role } from "@/db/schema";

import { resolveAudience, type Audience } from "./audience";
import { normalizePhone, sendZaia } from "./zaia";

/**
 * Formulários com confirmação de resposta.
 *
 * O ponto do módulo não é coletar resposta — é saber QUEM FALTA. O dashboard do
 * gestor e o lembrete do Cron saem ambos da mesma conta: audiência menos quem
 * já respondeu.
 */

export type CreateFormResult =
  | { ok: true; id: string; recipients: number }
  | { ok: false; error: string };

const QUESTION_TYPES = [
  "text",
  "textarea",
  "select",
  "radio",
  "checkbox",
  "date",
] as const;

/** Tipos que não fazem sentido sem lista de opções. */
const NEEDS_OPTIONS = new Set(["select", "radio", "checkbox"]);

export function validateQuestions(questions: FormQuestion[]): string | null {
  if (questions.length === 0) return "Adicione ao menos uma pergunta.";

  for (const [i, q] of questions.entries()) {
    if (!q.label.trim()) return `A pergunta ${i + 1} está sem enunciado.`;
    if (!QUESTION_TYPES.includes(q.type)) {
      return `A pergunta ${i + 1} tem tipo inválido.`;
    }
    if (NEEDS_OPTIONS.has(q.type) && (q.options ?? []).filter(Boolean).length < 2) {
      return `A pergunta ${i + 1} é de múltipla escolha e precisa de ao menos 2 opções.`;
    }
  }
  return null;
}

export async function createForm(params: {
  title: string;
  description: string | null;
  questions: FormQuestion[];
  audience: Audience;
  reminderAfterHours: number;
  createdBy: string;
}): Promise<CreateFormResult> {
  const title = params.title.trim();
  if (!title) return { ok: false, error: "Informe o título do formulário." };

  const invalid = validateQuestions(params.questions);
  if (invalid) return { ok: false, error: invalid };

  const recipients = await resolveAudience(params.audience);
  if (recipients.length === 0) {
    return { ok: false, error: "Nenhum colaborador ativo se encaixa nessa audiência." };
  }

  const [created] = await db
    .insert(forms)
    .values({
      title,
      description: params.description?.trim() || null,
      questions: params.questions,
      audienceType: params.audience.type,
      audienceValue: params.audience.value,
      reminderAfterHours: params.reminderAfterHours,
      createdBy: params.createdBy,
    })
    .returning({ id: forms.id });

  await db.insert(notifications).values(
    recipients.map((r) => ({
      userId: r.id,
      title: `Novo formulário: ${title}`,
      body: params.description?.trim() || "Sua resposta é necessária.",
      link: `/formularios/${created.id}`,
    })),
  );

  return { ok: true, id: created.id, recipients: recipients.length };
}

/* ------------------------------------------------------------------ */
/* Resposta                                                            */
/* ------------------------------------------------------------------ */

export type AnswerResult = { ok: true } | { ok: false; error: string };

export async function submitResponse(params: {
  formId: string;
  userId: string;
  answers: Record<string, unknown>;
}): Promise<AnswerResult> {
  const form = await getForm(params.formId);
  if (!form) return { ok: false, error: "Formulário não encontrado." };
  if (form.closedAt) return { ok: false, error: "Este formulário já foi encerrado." };

  // Só quem está na audiência pode responder — a checagem é aqui, junto do dado,
  // não só na navegação.
  const audience = await resolveAudience({
    type: form.audienceType,
    value: form.audienceValue,
  });
  if (!audience.some((a) => a.id === params.userId)) {
    return { ok: false, error: "Este formulário não é destinado a você." };
  }

  for (const q of form.questions) {
    if (!q.required) continue;
    const answer = params.answers[q.id];
    const empty =
      answer === undefined ||
      answer === null ||
      answer === "" ||
      (Array.isArray(answer) && answer.length === 0);
    if (empty) return { ok: false, error: `Responda: ${q.label}` };
  }

  // Reenvio sobrescreve em vez de duplicar — o índice único (formId, userId)
  // garante isso mesmo com dois cliques simultâneos.
  await db
    .insert(formResponses)
    .values({ formId: params.formId, userId: params.userId, answers: params.answers })
    .onConflictDoUpdate({
      target: [formResponses.formId, formResponses.userId],
      set: { answers: params.answers, respondedAt: new Date() },
    });

  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Consultas                                                           */
/* ------------------------------------------------------------------ */

export async function getForm(id: string) {
  const [row] = await db.select().from(forms).where(eq(forms.id, id)).limit(1);
  return row ?? null;
}

/** Formulários que a pessoa precisa responder, com o próprio status. */
export async function listFormsForUser(userId: string) {
  const all = await db.select().from(forms).orderBy(desc(forms.createdAt));

  const mine = await db
    .select({ formId: formResponses.formId, respondedAt: formResponses.respondedAt })
    .from(formResponses)
    .where(eq(formResponses.userId, userId));

  const result = [];
  for (const form of all) {
    const audience = await resolveAudience({
      type: form.audienceType,
      value: form.audienceValue,
    });
    if (!audience.some((a) => a.id === userId)) continue;

    const response = mine.find((m) => m.formId === form.id);
    result.push({
      id: form.id,
      title: form.title,
      description: form.description,
      createdAt: form.createdAt,
      closedAt: form.closedAt,
      respondedAt: response?.respondedAt ?? null,
    });
  }
  return result;
}

export type FormScoreboard = {
  form: typeof forms.$inferSelect;
  responded: { id: string; name: string; respondedAt: Date }[];
  missing: { id: string; name: string; managerId: string | null }[];
};

/**
 * Placar de um formulário: quem respondeu e quem falta.
 *
 * `scopeToManager` limita ao time do gestor — RH passa `null` e vê tudo.
 * O escopo é aplicado sobre a AUDIÊNCIA, então um gestor nunca enxerga gente
 * de outra equipe mesmo que o formulário tenha sido para a empresa inteira.
 */
export async function getScoreboard(
  formId: string,
  scopeToManager: string | null,
): Promise<FormScoreboard | null> {
  const form = await getForm(formId);
  if (!form) return null;

  let audience = await resolveAudience({
    type: form.audienceType,
    value: form.audienceValue,
  });

  if (scopeToManager) {
    audience = audience.filter((a) => a.managerId === scopeToManager);
  }

  const responses = await db
    .select({
      userId: formResponses.userId,
      respondedAt: formResponses.respondedAt,
      name: users.name,
    })
    .from(formResponses)
    .innerJoin(users, eq(users.id, formResponses.userId))
    .where(eq(formResponses.formId, formId));

  const respondedIds = new Set(responses.map((r) => r.userId));

  return {
    form,
    responded: responses
      .filter((r) => audience.some((a) => a.id === r.userId))
      .map((r) => ({ id: r.userId, name: r.name, respondedAt: r.respondedAt })),
    missing: audience
      .filter((a) => !respondedIds.has(a.id))
      .map((a) => ({ id: a.id, name: a.name, managerId: a.managerId })),
  };
}

/** Formulários visíveis no painel: RH vê todos; gestor vê os que atingem seu time. */
export async function listFormsForDashboard(approver: { id: string; role: Role }) {
  const all = await db.select().from(forms).orderBy(desc(forms.createdAt));

  const result = [];
  for (const form of all) {
    const board = await getScoreboard(
      form.id,
      approver.role === "admin" ? null : approver.id,
    );
    if (!board) continue;

    const total = board.responded.length + board.missing.length;
    if (total === 0) continue; // não atinge ninguém do time deste gestor

    result.push({
      id: form.id,
      title: form.title,
      createdAt: form.createdAt,
      closedAt: form.closedAt,
      responded: board.responded.length,
      missing: board.missing.length,
      total,
    });
  }
  return result;
}

export async function getResponses(formId: string) {
  return db
    .select({
      userId: formResponses.userId,
      name: users.name,
      answers: formResponses.answers,
      respondedAt: formResponses.respondedAt,
    })
    .from(formResponses)
    .innerJoin(users, eq(users.id, formResponses.userId))
    .where(eq(formResponses.formId, formId))
    .orderBy(users.name);
}

/* ------------------------------------------------------------------ */
/* Lembrete automático (Vercel Cron)                                   */
/* ------------------------------------------------------------------ */

export type ReminderReport = {
  formsChecked: number;
  formsOverdue: number;
  managersNotified: number;
  peoplePending: number;
  details: { form: string; manager: string; pending: string[]; sent: boolean }[];
};

/**
 * Varre formulários vencidos e cobra os gestores.
 *
 * UM WhatsApp CONSOLIDADO por gestor, listando quem da equipe dele falta —
 * não uma mensagem por colaborador. O gestor cobra o time; o sistema não
 * persegue a pessoa.
 */
export async function sendPendingReminders(): Promise<ReminderReport> {
  const now = Date.now();

  const open = await db
    .select()
    .from(forms)
    .where(isNull(forms.closedAt));

  const report: ReminderReport = {
    formsChecked: open.length,
    formsOverdue: 0,
    managersNotified: 0,
    peoplePending: 0,
    details: [],
  };

  for (const form of open) {
    const dueAt = form.createdAt.getTime() + form.reminderAfterHours * 3_600_000;
    if (now < dueAt) continue;

    // Não recobra antes de uma nova janela inteira passar.
    if (
      form.lastReminderAt &&
      now < form.lastReminderAt.getTime() + form.reminderAfterHours * 3_600_000
    ) {
      continue;
    }

    const board = await getScoreboard(form.id, null);
    if (!board || board.missing.length === 0) continue;

    report.formsOverdue++;
    report.peoplePending += board.missing.length;

    // Agrupa os faltantes por gestor.
    const byManager = new Map<string, string[]>();
    for (const person of board.missing) {
      if (!person.managerId) continue; // sem gestor, ninguém a cobrar
      const list = byManager.get(person.managerId) ?? [];
      list.push(person.name);
      byManager.set(person.managerId, list);
    }

    for (const [managerId, pendingNames] of byManager) {
      const [manager] = await db
        .select({ name: users.name, phone: users.phone })
        .from(users)
        .where(eq(users.id, managerId))
        .limit(1);
      if (!manager) continue;

      const message =
        `Lembrete: ${pendingNames.length} pessoa(s) da sua equipe ainda não ` +
        `responderam o formulário "${form.title}":\n` +
        pendingNames.map((n) => `• ${n}`).join("\n") +
        `\n\nAcompanhe em /formularios/painel na Intranet RH.`;

      await db.insert(notifications).values({
        userId: managerId,
        title: `Pendências no formulário "${form.title}"`,
        body: `${pendingNames.length} pessoa(s) da sua equipe ainda não responderam.`,
        link: "/formularios/painel",
      });

      const phone = normalizePhone(manager.phone);
      let sent = false;
      if (phone) {
        const result = await sendZaia({
          template: "form_reminder",
          phone,
          name: manager.name.split(" ")[0],
          message,
        });
        sent = result.ok;
      }

      report.managersNotified++;
      report.details.push({
        form: form.title,
        manager: manager.name,
        pending: pendingNames,
        sent,
      });
    }

    await db
      .update(forms)
      .set({ lastReminderAt: new Date() })
      .where(eq(forms.id, form.id));
  }

  return report;
}

export async function closeForm(id: string) {
  await db.update(forms).set({ closedAt: new Date() }).where(eq(forms.id, id));
}

export async function reopenForm(id: string) {
  await db.update(forms).set({ closedAt: null }).where(eq(forms.id, id));
}

/** Formulários abertos que a pessoa ainda não respondeu — usado no badge da home. */
export async function countPendingForUser(userId: string): Promise<number> {
  const pending = await db
    .select({ id: forms.id })
    .from(forms)
    .leftJoin(
      formResponses,
      and(eq(formResponses.formId, forms.id), eq(formResponses.userId, userId)),
    )
    .where(and(isNull(forms.closedAt), isNull(formResponses.id)));

  let count = 0;
  for (const form of pending) {
    const full = await getForm(form.id);
    if (!full) continue;
    const audience = await resolveAudience({
      type: full.audienceType,
      value: full.audienceValue,
    });
    if (audience.some((a) => a.id === userId)) count++;
  }
  return count;
}
