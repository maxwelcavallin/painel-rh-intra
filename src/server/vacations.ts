import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { users, vacationRequests } from "@/db/schema";
import type { Role } from "@/db/schema";

import { judgeVacationRequest } from "./agent";
import { buildVacationFacts, daysBetweenInclusive, formatBR } from "./facts";
import {
  approversFor,
  notifyInApp,
  notifyManagerPrivately,
  notifyWhatsApp,
} from "./notify";

export type Decision = "pending" | "approved" | "rejected";

/**
 * Status consolidado. Derivado, nunca escrito à mão em dois lugares.
 * Colaborador sem gestor cadastrado depende só do RH.
 */
function consolidate(params: {
  rhApproval: Decision;
  managerApproval: Decision;
  hasManager: boolean;
}): Decision {
  if (params.rhApproval === "rejected") return "rejected";
  if (params.hasManager && params.managerApproval === "rejected") {
    return "rejected";
  }
  if (params.rhApproval !== "approved") return "pending";
  if (params.hasManager && params.managerApproval !== "approved") return "pending";
  return "approved";
}

/* ------------------------------------------------------------------ */
/* Criação                                                             */
/* ------------------------------------------------------------------ */

export type CreateResult =
  | { ok: true; id: string; status: Decision; reasoning: string }
  | { ok: false; error: string };

export async function createVacationRequest(params: {
  userId: string;
  startDate: string;
  endDate: string;
  notes: string | null;
}): Promise<CreateResult> {
  const { userId, startDate, endDate, notes } = params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return { ok: false, error: "Datas inválidas." };
  }
  if (endDate < startDate) {
    return { ok: false, error: "A data de término é anterior à de início." };
  }

  const facts = await buildVacationFacts({ userId, startDate, endDate });
  const verdict = await judgeVacationRequest(facts, notes);

  // Bloqueio legal decide sozinho. Recomendação de aprovar/revisar ainda
  // passa por humano — a IA sugere, RH e gestor confirmam.
  const status: Decision = verdict.recommendation === "reject" ? "rejected" : "pending";

  const [created] = await db
    .insert(vacationRequests)
    .values({
      userId,
      startDate,
      endDate,
      days: daysBetweenInclusive(startDate, endDate),
      notes: notes?.trim() || null,
      status,
      aiRecommendation: verdict.recommendation,
      aiReasoning: verdict.reasoning,
      aiConflicts: facts.conflicts,
      aiWarnings: facts.warnings,
      aiFacts: facts,
    })
    .returning({ id: vacationRequests.id });

  const period = `${formatBR(startDate)} a ${formatBR(endDate)}`;

  // Notificações são efeito colateral: nunca desfazem a solicitação já gravada.
  if (status === "rejected") {
    await notifyWhatsApp({
      userId,
      message:
        `Sua solicitação de férias (${period}) foi reprovada automaticamente. ` +
        `${verdict.reasoning} Fale com o RH se precisar de ajuda para reagendar.`,
    });
  } else {
    // Nada de webhook aqui: ele publica num canal geral, e solicitação de férias
    // é nominal — assunto entre a pessoa, o gestor dela e o RH. O webhook fica
    // reservado aos avisos gerais do RH (Fase 3).
    const approvers = await approversFor(userId);
    await notifyInApp({
      userIds: approvers,
      title: "Nova solicitação de férias",
      body: `${facts.employee.name} solicitou férias de ${period} (${facts.request.days} dias). Recomendação da IA: ${verdict.recommendation}.`,
      link: "/aprovacoes",
    });

    // O gestor direto também recebe no privado, para não depender de abrir a intranet.
    const [employee] = await db
      .select({ managerId: users.managerId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (employee?.managerId) {
      await notifyManagerPrivately({
        managerId: employee.managerId,
        message:
          `${facts.employee.name} solicitou férias de ${period} ` +
          `(${facts.request.days} dias corridos). Recomendação da análise automática: ` +
          `${verdict.recommendation}. ${verdict.reasoning} ` +
          `Aprove ou reprove em /aprovacoes na Intranet RH.`,
      });
    }
  }

  return { ok: true, id: created.id, status, reasoning: verdict.reasoning };
}

/* ------------------------------------------------------------------ */
/* Decisão humana                                                      */
/* ------------------------------------------------------------------ */

export type DecideResult = { ok: true } | { ok: false; error: string };

export async function decideVacationRequest(params: {
  requestId: string;
  decider: { id: string; role: Role };
  decision: "approved" | "rejected";
  note: string | null;
}): Promise<DecideResult> {
  const { requestId, decider, decision, note } = params;

  const [row] = await db
    .select({
      request: vacationRequests,
      employeeName: users.name,
      employeeManagerId: users.managerId,
    })
    .from(vacationRequests)
    .innerJoin(users, eq(users.id, vacationRequests.userId))
    .where(eq(vacationRequests.id, requestId))
    .limit(1);

  if (!row) return { ok: false, error: "Solicitação não encontrada." };

  const { request } = row;

  // Autorização checada aqui de novo, junto do dado — nunca só na UI.
  const isRH = decider.role === "admin";
  const isTheirManager =
    decider.role === "gestor" && row.employeeManagerId === decider.id;

  if (!isRH && !isTheirManager) {
    return { ok: false, error: "Você não pode decidir esta solicitação." };
  }

  if (request.status === "rejected" && request.aiRecommendation === "reject") {
    return {
      ok: false,
      error:
        "Esta solicitação tem impedimento legal e não pode ser aprovada. O colaborador precisa enviar novas datas.",
    };
  }

  const now = new Date();
  const hasManager = row.employeeManagerId !== null;

  const rhApproval: Decision = isRH ? decision : request.rhApproval;
  const managerApproval: Decision = isTheirManager
    ? decision
    : request.managerApproval;

  const status = consolidate({ rhApproval, managerApproval, hasManager });

  await db
    .update(vacationRequests)
    .set({
      rhApproval,
      managerApproval,
      status,
      updatedAt: now,
      ...(isRH
        ? { rhApprovedBy: decider.id, rhApprovedAt: now, rhNote: note }
        : { managerApprovedBy: decider.id, managerApprovedAt: now, managerNote: note }),
    })
    .where(eq(vacationRequests.id, requestId));

  const period = `${formatBR(request.startDate)} a ${formatBR(request.endDate)}`;

  if (status === "approved") {
    await notifyWhatsApp({
      userId: request.userId,
      message: `Boa notícia! Suas férias de ${period} foram aprovadas. Bom descanso!`,
    });
  } else if (status === "rejected") {
    await notifyWhatsApp({
      userId: request.userId,
      message:
        `Sua solicitação de férias (${period}) foi reprovada.` +
        (note ? ` Motivo: ${note}` : "") +
        " Fale com o RH para combinar novas datas.",
    });
  }

  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Consultas                                                           */
/* ------------------------------------------------------------------ */

export async function listMyRequests(userId: string) {
  return db
    .select()
    .from(vacationRequests)
    .where(eq(vacationRequests.userId, userId))
    .orderBy(desc(vacationRequests.createdAt));
}

/**
 * Fila de aprovação. RH vê tudo; gestor vê só quem se reporta a ele.
 * O escopo é aplicado na query, não na renderização.
 */
export async function listPendingForApprover(approver: { id: string; role: Role }) {
  const scope =
    approver.role === "admin"
      ? eq(vacationRequests.status, "pending")
      : and(
          eq(vacationRequests.status, "pending"),
          eq(users.managerId, approver.id),
        );

  return db
    .select({
      id: vacationRequests.id,
      userId: vacationRequests.userId,
      employeeName: users.name,
      employeeSector: users.sector,
      startDate: vacationRequests.startDate,
      endDate: vacationRequests.endDate,
      days: vacationRequests.days,
      notes: vacationRequests.notes,
      status: vacationRequests.status,
      rhApproval: vacationRequests.rhApproval,
      managerApproval: vacationRequests.managerApproval,
      aiRecommendation: vacationRequests.aiRecommendation,
      aiReasoning: vacationRequests.aiReasoning,
      aiConflicts: vacationRequests.aiConflicts,
      aiWarnings: vacationRequests.aiWarnings,
      createdAt: vacationRequests.createdAt,
    })
    .from(vacationRequests)
    .innerJoin(users, eq(users.id, vacationRequests.userId))
    .where(scope)
    .orderBy(desc(vacationRequests.createdAt));
}

/** Férias aprovadas — visível a qualquer colaborador logado (Fase 5). */
export async function listApprovedVacations() {
  return db
    .select({
      id: vacationRequests.id,
      employeeName: users.name,
      employeeSector: users.sector,
      startDate: vacationRequests.startDate,
      endDate: vacationRequests.endDate,
      days: vacationRequests.days,
    })
    .from(vacationRequests)
    .innerJoin(users, eq(users.id, vacationRequests.userId))
    .where(eq(vacationRequests.status, "approved"))
    .orderBy(vacationRequests.startDate);
}
