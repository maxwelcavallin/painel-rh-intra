import "server-only";

import { and, eq, isNull, ne } from "drizzle-orm";

import { db } from "@/db";
import { users, vacationRequests } from "@/db/schema";
import {
  COMPANY_NOTICE_DAYS,
  daysBetweenInclusive,
  formatBR,
  vacationDeadlineFor,
  type VacationDeadline,
} from "@/lib/clt";

import { notify } from "./notifications";

/**
 * Vencimento do período aquisitivo — a dor que o RH resolve hoje com planilha.
 *
 * O risco não é a pessoa deixar de tirar férias: é a empresa ultrapassar o
 * período CONCESSIVO e ter de pagar em dobro (art. 137 da CLT). Este módulo
 * calcula quem está perto disso e avisa antes, em vez de esperar alguém pedir.
 */

export type ExpiringVacation = {
  userId: string;
  name: string;
  sector: string | null;
  managerId: string | null;
  managerName: string | null;
  admissionDate: string;
  deadline: VacationDeadline;
  /** Dias já usufruídos no período que está vencendo. */
  daysTaken: number;
  daysRemaining: number;
  /** Há solicitação aprovada ou pendente que consome esse período. */
  hasScheduled: boolean;
  severity: "expired" | "critical" | "warning" | "ok";
};

/** 30 dias = crítico; 90 = atenção. Abaixo do prazo da política, já aperta. */
const CRITICAL_DAYS = 30;
const WARNING_DAYS = 90;

function severityFor(
  deadline: VacationDeadline,
  hasScheduled: boolean,
): ExpiringVacation["severity"] {
  // `settled` = tudo que venceu já foi usufruído. Não há relógio correndo.
  if (deadline.settled) return "ok";
  if (deadline.expired) return "expired";
  if (deadline.daysUntilDeadline <= CRITICAL_DAYS) return "critical";
  if (deadline.daysUntilDeadline <= WARNING_DAYS) {
    // Com férias já marcadas, deixa de ser urgente — vira acompanhamento.
    return hasScheduled ? "ok" : "warning";
  }
  return "ok";
}

/**
 * Situação de férias de todo mundo com admissão cadastrada.
 * `todayISO` entra por parâmetro para o cálculo ser testável.
 */
export async function listVacationStatus(
  todayISO: string = new Date().toISOString().slice(0, 10),
): Promise<ExpiringVacation[]> {
  const managers = { id: users.id, name: users.name };

  const people = await db
    .select({
      id: users.id,
      name: users.name,
      sector: users.sector,
      managerId: users.managerId,
      admissionDate: users.admissionDate,
    })
    .from(users)
    .where(and(eq(users.isActive, true), ne(users.employmentStatus, "desligado")));

  const managerRows = await db.select(managers).from(users);
  const managerName = new Map(managerRows.map((m) => [m.id, m.name]));

  // Solicitações que consomem saldo: aprovadas e pendentes, nunca canceladas.
  const requests = await db
    .select({
      userId: vacationRequests.userId,
      startDate: vacationRequests.startDate,
      endDate: vacationRequests.endDate,
      days: vacationRequests.days,
      abonoDays: vacationRequests.abonoDays,
      status: vacationRequests.status,
    })
    .from(vacationRequests)
    .where(isNull(vacationRequests.cancelledAt));

  const result: ExpiringVacation[] = [];

  for (const person of people) {
    if (!person.admissionDate) continue;

    const mine = requests.filter(
      (r) => r.userId === person.id && r.status !== "rejected",
    );

    // Só o que já foi APROVADO conta como usufruído — pendente ainda pode cair.
    // Abono consome saldo igual ao gozo.
    const daysTaken = mine
      .filter((r) => r.status === "approved")
      .reduce((sum, r) => sum + r.days + r.abonoDays, 0);

    // O prazo depende de quanto já foi usufruído: os períodos são quitados em
    // ordem, e o que prende é o mais antigo ainda em aberto.
    const deadline = vacationDeadlineFor(
      person.admissionDate,
      todayISO,
      daysTaken,
    );

    // Solicitação que ainda VAI acontecer e cabe dentro do prazo. Férias
    // passadas não entram: elas já foram contadas em `daysTaken` e deixariam
    // qualquer veterano marcado como "resolvido" para sempre.
    const hasScheduled = mine.some(
      (r) => r.startDate >= todayISO && r.startDate <= deadline.concessiveEnd,
    );

    result.push({
      userId: person.id,
      name: person.name,
      sector: person.sector,
      managerId: person.managerId,
      managerName: person.managerId
        ? (managerName.get(person.managerId) ?? null)
        : null,
      admissionDate: person.admissionDate,
      deadline,
      daysTaken,
      daysRemaining: deadline.daysRemainingInPeriod,
      hasScheduled,
      severity: severityFor(deadline, hasScheduled),
    });
  }

  return result.sort(
    (a, b) => a.deadline.daysUntilDeadline - b.deadline.daysUntilDeadline,
  );
}

export type ExpiringReport = {
  checked: number;
  expired: number;
  critical: number;
  warning: number;
  notified: number;
};

/**
 * Avisa quem precisa agir sobre férias prestes a vencer.
 *
 * Colaborador e gestor recebem; o RH acompanha pelo painel, para não receber
 * 110 mensagens. Só dispara para `expired` e `critical` — `warning` fica na
 * tela, sem incomodar ninguém.
 */
export async function notifyExpiringVacations(
  todayISO: string = new Date().toISOString().slice(0, 10),
): Promise<ExpiringReport> {
  const status = await listVacationStatus(todayISO);

  const report: ExpiringReport = {
    checked: status.length,
    expired: status.filter((s) => s.severity === "expired").length,
    critical: status.filter((s) => s.severity === "critical").length,
    warning: status.filter((s) => s.severity === "warning").length,
    notified: 0,
  };

  const urgentes = status.filter(
    (s) => s.severity === "expired" || s.severity === "critical",
  );

  for (const item of urgentes) {
    const prazo = formatBR(item.deadline.concessiveEnd);
    const vencido = item.severity === "expired";

    /**
     * O mesmo webhook atende colaborador e gestor, então quem varia é o
     * SUJEITO da frase — o servidor manda pronto porque "as férias de Bruno"
     * lido pelo próprio Bruno fica errado.
     */
    const camposZaia = {
      colaborador: item.name,
      prazo,
      saldo: String(item.daysRemaining),
    };

    const paraColaborador = vencido
      ? `Atenção: seu período aquisitivo de férias venceu em ${prazo} e ainda ` +
        `restam ${item.daysRemaining} dia(s) a usufruir. Procure o RH para regularizar.`
      : `Suas férias precisam ser concedidas até ${prazo} — faltam ` +
        `${item.deadline.daysUntilDeadline} dia(s) e você tem ${item.daysRemaining} ` +
        `dia(s) de saldo. Lembre que a solicitação pede ${COMPANY_NOTICE_DAYS} dias de antecedência.`;

    await notify({
      type: "vacation_expiring",
      userId: item.userId,
      title: vencido ? "Férias vencidas" : "Férias a vencer",
      message: paraColaborador,
      link: "/ferias/solicitar",
      extra: { ...camposZaia, sujeito: "suas férias" },
    });
    report.notified++;

    if (item.managerId) {
      await notify({
        type: "vacation_expiring",
        userId: item.managerId,
        title: vencido
          ? `Férias vencidas: ${item.name}`
          : `Férias a vencer: ${item.name}`,
        message:
          `${item.name} tem ${item.daysRemaining} dia(s) de férias a usufruir e ` +
          `o prazo de concessão ${vencido ? "venceu" : "termina"} em ${prazo}. ` +
          `Passar desse prazo obriga a empresa a pagar em dobro (art. 137 da CLT).`,
        link: "/ferias/vencimentos",
        extra: { ...camposZaia, sujeito: `as férias de ${item.name}` },
      });
      report.notified++;
    }
  }

  return report;
}

/** Quantos dias faltam para a data-limite de pagamento, a partir de hoje. */
export function daysUntil(iso: string, todayISO: string): number {
  return daysBetweenInclusive(todayISO, iso) - 1;
}
