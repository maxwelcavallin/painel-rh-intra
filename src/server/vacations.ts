import "server-only";

import { and, desc, eq, isNotNull, isNull, ne } from "drizzle-orm";

import { db } from "@/db";
import { users, vacationRequests } from "@/db/schema";
import type { Role } from "@/db/schema";
import { paymentDeadline } from "@/lib/clt";

import { judgeVacationRequest } from "./agent";
import { buildVacationFacts, daysBetweenInclusive, formatBR } from "./facts";
import { getHolidaysForRange } from "./holidays";
import { notify } from "./notifications";

export type Decision = "pending" | "approved" | "rejected" | "cancelled";

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

/** Data-limite de pagamento (art. 145), descontando fim de semana e feriado. */
async function computePaymentDue(startDate: string): Promise<string> {
  const holidays = await getHolidaysForRange(
    // Janela folgada para trás: emenda de feriado pode empurrar vários dias.
    startDate,
    startDate,
  );
  return paymentDeadline(startDate, new Set(holidays.map((h) => h.date)));
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
  abonoDays: number;
  advance13th: boolean;
  notes: string | null;
}): Promise<CreateResult> {
  const { userId, startDate, endDate, abonoDays, advance13th, notes } = params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return { ok: false, error: "Datas inválidas." };
  }
  if (endDate < startDate) {
    return { ok: false, error: "A data de término é anterior à de início." };
  }
  if (!Number.isInteger(abonoDays) || abonoDays < 0) {
    return { ok: false, error: "Dias de abono inválidos." };
  }

  const facts = await buildVacationFacts({ userId, startDate, endDate, abonoDays, advance13th });
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
      abonoPecuniario: abonoDays > 0,
      abonoDays,
      advance13th,
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

  /**
   * Campos que o template da Zaia monta sozinho, além de nome/mensagem.
   *
   * Só nome, datas e contagens entram aqui — CPF, RG, endereço e telefone de
   * terceiros nunca trafegam no corpo da mensagem.
   */
  const camposZaia = {
    colaborador: facts.employee.name,
    inicio: formatBR(startDate),
    fim: formatBR(endDate),
    dias: String(facts.request.days),
  };

  const extras = [
    abonoDays > 0 ? `${abonoDays} dia(s) de abono pecuniário` : null,
    advance13th ? "com antecipação do 13º" : null,
  ]
    .filter(Boolean)
    .join(", ");

  if (status === "rejected") {
    await notify({
      type: "vacation_decision",
      userId,
      title: "Solicitação de férias reprovada",
      message:
        `Sua solicitação de férias (${period}) foi reprovada automaticamente. ` +
        `${verdict.reasoning} Fale com o RH se precisar de ajuda para reagendar.`,
      link: "/ferias/minhas",
      extra: { ...camposZaia, decisao: "reprovadas" },
    });
  } else {
    const [employee] = await db
      .select({ managerId: users.managerId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (employee?.managerId) {
      await notify({
        type: "vacation_request",
        userId: employee.managerId,
        title: "Nova solicitação de férias",
        message:
          `${facts.employee.name} solicitou férias de ${period} ` +
          `(${facts.request.days} dias corridos${extras ? `, ${extras}` : ""}). ` +
          `Análise automática: ${verdict.recommendation}. ${verdict.reasoning}`,
        link: "/aprovacoes",
        extra: camposZaia,
      });
    }

    // RH acompanha pelo painel, sem receber uma mensagem por solicitação.
    const rhUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, "admin"), eq(users.isActive, true)));

    for (const rh of rhUsers) {
      await notify({
        type: "vacation_request",
        userId: rh.id,
        title: "Nova solicitação de férias",
        message: `${facts.employee.name} — ${period} (${facts.request.days} dias${extras ? `, ${extras}` : ""}).`,
        link: "/aprovacoes",
        extra: camposZaia,
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

  if (request.cancelledAt) {
    return { ok: false, error: "Esta solicitação foi cancelada." };
  }

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

  // Ao aprovar, o prazo de pagamento passa a existir — é o relógio da multa.
  const paymentDueDate =
    status === "approved" && !request.paymentDueDate
      ? await computePaymentDue(request.startDate)
      : request.paymentDueDate;

  await db
    .update(vacationRequests)
    .set({
      rhApproval,
      managerApproval,
      status,
      paymentDueDate,
      updatedAt: now,
      ...(isRH
        ? { rhApprovedBy: decider.id, rhApprovedAt: now, rhNote: note }
        : { managerApprovedBy: decider.id, managerApprovedAt: now, managerNote: note }),
    })
    .where(eq(vacationRequests.id, requestId));

  const period = `${formatBR(request.startDate)} a ${formatBR(request.endDate)}`;
  const camposZaia = {
    colaborador: row.employeeName,
    inicio: formatBR(request.startDate),
    fim: formatBR(request.endDate),
    dias: String(request.days),
  };

  if (status === "approved") {
    await notify({
      type: "vacation_decision",
      userId: request.userId,
      title: "Férias aprovadas",
      message:
        `Boa notícia! Suas férias de ${period} foram aprovadas. ` +
        `O pagamento é devido até ${formatBR(paymentDueDate!)} e o recibo precisa ` +
        `ser assinado antes do início. Bom descanso!`,
      link: "/ferias/minhas",
      extra: { ...camposZaia, decisao: "aprovadas" },
    });
  } else if (status === "rejected") {
    await notify({
      type: "vacation_decision",
      userId: request.userId,
      title: "Solicitação de férias reprovada",
      message:
        `Sua solicitação de férias (${period}) foi reprovada.` +
        (note ? ` Motivo: ${note}` : "") +
        " Fale com o RH para combinar novas datas.",
      link: "/ferias/minhas",
      extra: { ...camposZaia, decisao: "reprovadas" },
    });
  }

  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Cancelamento / remanejamento                                        */
/* ------------------------------------------------------------------ */

/**
 * Cancela uma solicitação. Remanejar é cancelar e abrir outra — assim o
 * histórico de quem pediu o quê e quando não some, o que importa para a
 * prestação de contas.
 *
 * Colaborador cancela a própria; RH cancela qualquer uma.
 */
export async function cancelVacationRequest(params: {
  requestId: string;
  actor: { id: string; role: Role };
  reason: string | null;
}): Promise<DecideResult> {
  const [row] = await db
    .select({
      request: vacationRequests,
      employeeName: users.name,
    })
    .from(vacationRequests)
    .innerJoin(users, eq(users.id, vacationRequests.userId))
    .where(eq(vacationRequests.id, params.requestId))
    .limit(1);

  if (!row) return { ok: false, error: "Solicitação não encontrada." };
  if (row.request.cancelledAt) {
    return { ok: false, error: "Esta solicitação já está cancelada." };
  }

  const isRH = params.actor.role === "admin";
  const isOwner = row.request.userId === params.actor.id;
  if (!isRH && !isOwner) {
    return { ok: false, error: "Você não pode cancelar esta solicitação." };
  }

  // Depois de pago, cancelar deixa de ser operação de tela: envolve estorno.
  if (row.request.paidAt && !isRH) {
    return {
      ok: false,
      error: "Estas férias já foram pagas. Só o RH pode cancelar.",
    };
  }

  const now = new Date();
  await db
    .update(vacationRequests)
    .set({
      status: "cancelled",
      cancelledAt: now,
      cancelledBy: params.actor.id,
      cancelReason: params.reason?.trim() || null,
      updatedAt: now,
    })
    .where(eq(vacationRequests.id, params.requestId));

  const period = `${formatBR(row.request.startDate)} a ${formatBR(row.request.endDate)}`;
  const camposZaia = {
    colaborador: row.employeeName,
    inicio: formatBR(row.request.startDate),
    fim: formatBR(row.request.endDate),
    dias: String(row.request.days),
    decisao: "canceladas",
  };

  // Quem não cancelou precisa saber.
  if (!isOwner) {
    await notify({
      type: "vacation_decision",
      userId: row.request.userId,
      title: "Férias canceladas",
      message:
        `Suas férias de ${period} foram canceladas pelo RH.` +
        (params.reason ? ` Motivo: ${params.reason}` : "") +
        " Procure o RH para remarcar.",
      link: "/ferias/minhas",
      extra: camposZaia,
    });
  } else {
    const rhUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, "admin"), eq(users.isActive, true)));

    for (const rh of rhUsers) {
      await notify({
        type: "vacation_decision",
        userId: rh.id,
        title: "Férias canceladas pelo colaborador",
        message:
          `${row.employeeName} cancelou as férias de ${period}.` +
          (params.reason ? ` Motivo: ${params.reason}` : ""),
        link: "/aprovacoes",
        extra: camposZaia,
      });
    }
  }

  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Recibo e pagamento — onde a multa acontece                          */
/* ------------------------------------------------------------------ */

export async function registerReceiptSigned(params: {
  requestId: string;
  rhId: string;
}): Promise<DecideResult> {
  const [request] = await db
    .select()
    .from(vacationRequests)
    .where(eq(vacationRequests.id, params.requestId))
    .limit(1);

  if (!request) return { ok: false, error: "Solicitação não encontrada." };
  if (request.status !== "approved") {
    return { ok: false, error: "Só férias aprovadas têm recibo." };
  }

  await db
    .update(vacationRequests)
    .set({
      receiptSignedAt: new Date(),
      receiptRegisteredBy: params.rhId,
      updatedAt: new Date(),
    })
    .where(eq(vacationRequests.id, params.requestId));

  return { ok: true };
}

export async function registerPayment(params: {
  requestId: string;
  rhId: string;
}): Promise<DecideResult> {
  const [request] = await db
    .select()
    .from(vacationRequests)
    .where(eq(vacationRequests.id, params.requestId))
    .limit(1);

  if (!request) return { ok: false, error: "Solicitação não encontrada." };
  if (request.status !== "approved") {
    return { ok: false, error: "Só férias aprovadas têm pagamento." };
  }

  await db
    .update(vacationRequests)
    .set({ paidAt: new Date(), paidBy: params.rhId, updatedAt: new Date() })
    .where(eq(vacationRequests.id, params.requestId));

  return { ok: true };
}

/** Marca um lote como repassado à Senior (dias 10 e 20). */
export async function markReportedToSenior(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const now = new Date();
  for (const id of ids) {
    await db
      .update(vacationRequests)
      .set({ reportedToSeniorAt: now })
      .where(eq(vacationRequests.id, id));
  }
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
      abonoDays: vacationRequests.abonoDays,
      advance13th: vacationRequests.advance13th,
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
    .where(and(scope, isNull(vacationRequests.cancelledAt)))
    .orderBy(desc(vacationRequests.createdAt));
}

/** Férias aprovadas — visível a qualquer colaborador logado. */
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

/** Férias da equipe da pessoa, para ela ver ANTES de escolher a data. */
export async function listTeamVacations(userId: string) {
  const [me] = await db
    .select({ managerId: users.managerId, sector: users.sector })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const scope = me?.managerId
    ? eq(users.managerId, me.managerId)
    : me?.sector
      ? eq(users.sector, me.sector)
      : null;

  if (!scope) return [];

  return db
    .select({
      id: vacationRequests.id,
      name: users.name,
      startDate: vacationRequests.startDate,
      endDate: vacationRequests.endDate,
      days: vacationRequests.days,
      status: vacationRequests.status,
    })
    .from(vacationRequests)
    .innerJoin(users, eq(users.id, vacationRequests.userId))
    .where(
      and(
        scope,
        ne(vacationRequests.userId, userId),
        isNull(vacationRequests.cancelledAt),
        ne(vacationRequests.status, "rejected"),
      ),
    )
    .orderBy(vacationRequests.startDate);
}

/** Controle operacional do RH: recibo e pagamento das férias aprovadas. */
export async function listOperationalControl() {
  return db
    .select({
      id: vacationRequests.id,
      employeeName: users.name,
      employeeCpf: users.cpf,
      startDate: vacationRequests.startDate,
      endDate: vacationRequests.endDate,
      days: vacationRequests.days,
      abonoDays: vacationRequests.abonoDays,
      advance13th: vacationRequests.advance13th,
      paymentDueDate: vacationRequests.paymentDueDate,
      paidAt: vacationRequests.paidAt,
      receiptSignedAt: vacationRequests.receiptSignedAt,
      reportedToSeniorAt: vacationRequests.reportedToSeniorAt,
    })
    .from(vacationRequests)
    .innerJoin(users, eq(users.id, vacationRequests.userId))
    .where(
      and(
        eq(vacationRequests.status, "approved"),
        isNull(vacationRequests.cancelledAt),
        isNotNull(vacationRequests.paymentDueDate),
      ),
    )
    .orderBy(vacationRequests.startDate);
}
