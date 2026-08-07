import "server-only";

import { and, eq, ne, or } from "drizzle-orm";

import { db } from "@/db";
import { users, vacationRequests } from "@/db/schema";
import {
  acquisitivePeriodFor,
  addDays,
  blockedStartWeekdays,
  daysBetweenInclusive,
  formatBR,
  COMPANY_NOTICE_DAYS,
  LEGAL_NOTICE_DAYS,
  MAX_DAYS_PER_PERIOD,
  MIN_ANY_FRACTION,
  MIN_LONGEST_FRACTION,
  rangesOverlap,
  todayISOBrazil,
  validateAbono,
  toUTC,
  twoDaysAfter,
  WEEKDAY_NAME,
  WEEKLY_REST_DAY,
  weekdayOf,
  type AcquisitivePeriod,
} from "@/lib/clt";

import { getHolidaysForRange, type Holiday } from "./holidays";

/**
 * Fatos determinísticos sobre uma solicitação de férias.
 *
 * Esta camada NÃO opina — ela mede. Regras que a lei trata como vedação viram
 * `conflicts` (bloqueio duro); o resto vira `warnings`. A IA recebe isto pronto
 * e julga em cima; ela nunca recalcula data nem inventa saldo.
 */

/**
 * Toda a aritmética de data e as constantes legais vivem em `@/lib/clt` —
 * funções puras, testáveis sem banco (ver `scripts/smoke-clt.ts`).
 */

function todayISO(): string {
  // Regra trabalhista é local — usar UTC daria "amanhã" após 21h de Brasília
  // e derrubaria `startsInThePast`/`noticeDays` no período noturno.
  return todayISOBrazil();
}

/**
 * "o feriado nacional Natal" / "o ponto facultativo nacional Carnaval".
 *
 * Chamar ponto facultativo de feriado numa mensagem que REPROVA a solicitação
 * seria dar informação errada sobre a lei justamente onde ela é citada.
 */
function describeHoliday(holiday: Holiday): string {
  const kind = holiday.optional ? "o ponto facultativo" : "o feriado";
  return `${kind} ${holiday.scope} "${holiday.name}"`;
}

/* ------------------------------------------------------------------ */
/* Tipo do resultado                                                   */
/* ------------------------------------------------------------------ */

export type VacationFacts = {
  request: {
    startDate: string;
    endDate: string;
    days: number;
    abonoDays: number;
    startWeekday: string;
  };
  employee: {
    id: string;
    name: string;
    sector: string | null;
    admissionDate: string | null;
    monthsSinceAdmission: number | null;
  };
  balance: {
    acquisitivePeriod: AcquisitivePeriod | null;
    daysAlreadyTaken: number;
    daysRequested: number;
    daysRemainingAfter: number | null;
  };
  /** Cada flag é verdadeira/falsa por medição, nunca por opinião. */
  flags: {
    endBeforeStart: boolean;
    startsInThePast: boolean;
    beforeFirstAcquisitivePeriod: boolean;
    selfOverlaps: boolean;
    exceedsAnnualLimit: boolean;
    startsOnHoliday: boolean;
    startsOnWeeklyRest: boolean;
    startsWithinTwoDaysOfHoliday: boolean;
    startsWithinTwoDaysOfWeeklyRest: boolean;
    belowMinimumFraction: boolean;
    insufficientNotice: boolean;
    teamOverlap: boolean;
  };
  details: {
    /** Feriado em cima do próprio dia de início, se houver. */
    startHoliday: Holiday | null;
    /** Feriado que disparou o bloqueio, se houver. */
    blockingHoliday: Holiday | null;
    overlappingOwnRequests: { start: string; end: string; status: string }[];
    teammatesOnVacation: { name: string; start: string; end: string }[];
    holidaysInsideRange: Holiday[];
    noticeDays: number;
  };
  /** Bloqueios duros. Qualquer item aqui = reprovação automática. */
  conflicts: string[];
  /** Alertas que NÃO bloqueiam — a IA e o humano pesam. */
  warnings: string[];
};

/* ------------------------------------------------------------------ */
/* Cálculo                                                             */
/* ------------------------------------------------------------------ */

export async function buildVacationFacts(params: {
  userId: string;
  startDate: string;
  endDate: string;
  /** Dias vendidos como abono pecuniário (art. 143). Consomem o mesmo saldo. */
  abonoDays?: number;
  /** Antecipação da 1ª parcela do 13º (Lei 4.749/65) — só pode uma por ano. */
  advance13th?: boolean;
  /** Ignora esta solicitação ao checar sobreposição (usado ao reavaliar). */
  excludeRequestId?: string;
}): Promise<VacationFacts> {
  const { userId, startDate, endDate } = params;
  const abonoDays = params.abonoDays ?? 0;

  const [employee] = await db
    .select({
      id: users.id,
      name: users.name,
      sector: users.sector,
      admissionDate: users.admissionDate,
      managerId: users.managerId,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!employee) throw new Error("Colaborador não encontrado.");

  const conflicts: string[] = [];
  const warnings: string[] = [];

  const days = daysBetweenInclusive(startDate, endDate);
  const today = todayISO();

  /* --- Validações estruturais ------------------------------------- */

  const endBeforeStart = endDate < startDate;
  if (endBeforeStart) {
    conflicts.push("A data de término é anterior à data de início.");
  }

  const startsInThePast = startDate < today;
  if (startsInThePast) {
    conflicts.push(
      `A data de início (${formatBR(startDate)}) já passou. Férias não podem ser solicitadas retroativamente.`,
    );
  }

  /* --- Período aquisitivo ----------------------------------------- */

  let monthsSinceAdmission: number | null = null;
  let acquisitivePeriod: AcquisitivePeriod | null = null;
  let beforeFirstAcquisitivePeriod = false;

  if (employee.admissionDate) {
    const admission = toUTC(employee.admissionDate);
    const start = toUTC(startDate);
    monthsSinceAdmission = Math.floor(
      (start.getTime() - admission.getTime()) / (30.44 * 86_400_000),
    );

    beforeFirstAcquisitivePeriod = start.getTime() < admission.getTime() + 365 * 86_400_000;
    if (beforeFirstAcquisitivePeriod) {
      conflicts.push(
        `O colaborador ainda não completou 12 meses de período aquisitivo (admissão em ${formatBR(employee.admissionDate)}). Art. 130 da CLT.`,
      );
    }

    acquisitivePeriod = acquisitivePeriodFor(employee.admissionDate, startDate);
  } else {
    warnings.push(
      "Data de admissão não cadastrada — não foi possível calcular o período aquisitivo nem o saldo.",
    );
  }

  /* --- Sobreposição com as próprias solicitações ------------------- */

  const ownRequests = await db
    .select({
      id: vacationRequests.id,
      startDate: vacationRequests.startDate,
      endDate: vacationRequests.endDate,
      status: vacationRequests.status,
      abonoDays: vacationRequests.abonoDays,
      advance13th: vacationRequests.advance13th,
    })
    .from(vacationRequests)
    .where(
      and(
        eq(vacationRequests.userId, userId),
        or(
          eq(vacationRequests.status, "approved"),
          eq(vacationRequests.status, "pending"),
        ),
        params.excludeRequestId
          ? ne(vacationRequests.id, params.excludeRequestId)
          : undefined,
      ),
    );

  const overlappingOwnRequests = ownRequests
    .filter((r) => rangesOverlap(startDate, endDate, r.startDate, r.endDate))
    .map((r) => ({ start: r.startDate, end: r.endDate, status: r.status }));

  const selfOverlaps = overlappingOwnRequests.length > 0;
  if (selfOverlaps) {
    const list = overlappingOwnRequests
      .map((r) => `${formatBR(r.start)} a ${formatBR(r.end)} (${r.status})`)
      .join("; ");
    conflicts.push(`O período se sobrepõe a outra solicitação sua: ${list}.`);
  }

  /* --- Saldo do período aquisitivo -------------------------------- */

  let daysAlreadyTaken = 0;
  let daysRemainingAfter: number | null = null;
  let exceedsAnnualLimit = false;

  if (acquisitivePeriod) {
    daysAlreadyTaken = ownRequests
      .filter(
        (r) =>
          r.status === "approved" &&
          r.startDate >= acquisitivePeriod!.start &&
          r.startDate <= acquisitivePeriod!.end,
      )
      .reduce(
        // Abono consome saldo igual ao gozo — ver vacation-deadlines.ts:107.
        (sum, r) => sum + daysBetweenInclusive(r.startDate, r.endDate) + r.abonoDays,
        0,
      );

    // Abono consome o mesmo saldo do gozo — vender 10 dias e tirar 30 não existe.
    const total = daysAlreadyTaken + days + abonoDays;
    daysRemainingAfter = MAX_DAYS_PER_PERIOD - total;
    exceedsAnnualLimit = total > MAX_DAYS_PER_PERIOD;

    if (exceedsAnnualLimit) {
      conflicts.push(
        `O total de ${total} dias${abonoDays > 0 ? ` (${days} de gozo + ${abonoDays} de abono)` : ""} ` +
          `excede o limite de ${MAX_DAYS_PER_PERIOD} dias do período aquisitivo ` +
          `(${formatBR(acquisitivePeriod.start)} a ${formatBR(acquisitivePeriod.end)}). ` +
          `Já usufruídos: ${daysAlreadyTaken} dias. Art. 130 da CLT.`,
      );
    }

    const abonoProblem = validateAbono({
      vacationDays: days,
      abonoDays,
      daysAlreadyTaken,
    });
    if (abonoProblem && !exceedsAnnualLimit) conflicts.push(abonoProblem);
  }

  /* --- Antecipação do 13º: uma por ano-calendário (Lei 4.749/65) ---- */

  if (params.advance13th) {
    const year = startDate.slice(0, 4);
    const priorAdvance = ownRequests.find(
      (r) =>
        r.status !== "rejected" &&
        r.advance13th &&
        r.startDate.startsWith(year),
    );
    if (priorAdvance) {
      warnings.push(
        `Já existe solicitação com antecipação do 13º em ${year} ` +
          `(início em ${formatBR(priorAdvance.startDate)}, status ${priorAdvance.status}). ` +
          `A Lei 4.749/65, art. 4º, permite apenas uma antecipação por ano-calendário — ` +
          `confira antes de aprovar.`,
      );
    }
  }

  /* --- Art. 134 §3º: feriado e DSR -------------------------------- */

  // A janela precisa passar de `endDate`: numa solicitação de 1 dia em 30/12,
  // o feriado que bloqueia (01/01) cai no ano seguinte.
  const holidays = await getHolidaysForRange(
    addDays(startDate, -5),
    addDays(endDate > startDate ? endDate : startDate, 5),
  );

  const startWeekday = weekdayOf(startDate);

  /*
   * O início precisa ser dia útil. São quatro medições independentes, e mais de
   * uma pode valer ao mesmo tempo — cada uma vira seu próprio conflito, para a
   * pessoa ver todos os motivos de uma vez em vez de descobrir um por tentativa.
   */

  // 1. O início cai EM CIMA de um feriado. Faltava, e era por aqui que passava
  //    pedido começando no 12/10 ou no 25/12.
  const startHoliday = holidays.find((h) => h.date === startDate) ?? null;
  const startsOnHoliday = startHoliday !== null;
  if (startHoliday) {
    conflicts.push(
      `${formatBR(startDate)} (${WEEKDAY_NAME[startWeekday]}) é ` +
        `${describeHoliday(startHoliday)}. As férias precisam começar em dia útil — ` +
        `começar num dia de folga consumiria um dia de férias que já seria de descanso ` +
        `(art. 134, §3º da CLT).`,
    );
  }

  // 2. O início cai no próprio dia de repouso semanal remunerado.
  const startsOnWeeklyRest = startWeekday === WEEKLY_REST_DAY;
  if (startsOnWeeklyRest) {
    conflicts.push(
      `O início em ${formatBR(startDate)} cai num ${WEEKDAY_NAME[WEEKLY_REST_DAY]}, ` +
        `dia de repouso semanal remunerado. As férias precisam começar em dia útil ` +
        `(art. 134, §3º da CLT).`,
    );
  }

  // 3. Feriado nos dois dias seguintes ao início — a vedação literal do §3º.
  const twoDaysBefore = twoDaysAfter(startDate);
  const blockingHoliday =
    holidays.find((h) => twoDaysBefore.includes(h.date)) ?? null;

  const startsWithinTwoDaysOfHoliday = blockingHoliday !== null;
  if (blockingHoliday) {
    conflicts.push(
      `O início em ${formatBR(startDate)} (${WEEKDAY_NAME[startWeekday]}) cai nos dois dias que antecedem ` +
        `${describeHoliday(blockingHoliday)} (${formatBR(blockingHoliday.date)}). ` +
        `Art. 134, §3º da CLT veda o início das férias nesse período.`,
    );
  }

  // 4. Dois dias antes do DSR (domingo) = sexta e sábado.
  //    Com a leitura estrita, o sábado também conta como descanso → quinta entra.
  const startsWithinTwoDaysOfWeeklyRest =
    blockedStartWeekdays().includes(startWeekday);

  if (startsWithinTwoDaysOfWeeklyRest) {
    conflicts.push(
      `O início em ${formatBR(startDate)} cai numa ${WEEKDAY_NAME[startWeekday]}, ` +
        `dentro dos dois dias que antecedem o repouso semanal remunerado ` +
        `(${WEEKDAY_NAME[WEEKLY_REST_DAY]}). Art. 134, §3º da CLT.`,
    );
  }

  /* --- Art. 134 §1º: fracionamento -------------------------------- */

  let belowMinimumFraction = false;
  if (!endBeforeStart && days < MIN_ANY_FRACTION) {
    belowMinimumFraction = true;
    conflicts.push(
      `Período de ${days} dia(s). Nenhuma fração de férias pode ter menos de ${MIN_ANY_FRACTION} dias corridos. Art. 134, §1º da CLT.`,
    );
  } else if (
    !endBeforeStart &&
    days < MIN_LONGEST_FRACTION &&
    daysAlreadyTaken === 0
  ) {
    warnings.push(
      `Esta é a primeira fração do período aquisitivo e tem ${days} dias. ` +
        `Ao fracionar, um dos períodos precisa ter no mínimo ${MIN_LONGEST_FRACTION} dias corridos (art. 134, §1º) — ` +
        `confirme que um período maior será usufruído depois.`,
    );
  }

  /* --- Art. 135: antecedência ------------------------------------- */

  const noticeDays = daysBetweenInclusive(today, startDate) - 1;
  const insufficientNotice =
    noticeDays < COMPANY_NOTICE_DAYS && !startsInThePast;

  if (insufficientNotice) {
    // Dois patamares distintos: a lei manda 30, a política da 01 Tecnologia
    // pede 40 porque o repasse à Senior sai em lote (dias 10 e 20) e a folha
    // precisa fechar antes. Abaixo de 30 o problema deixa de ser interno.
    warnings.push(
      noticeDays < LEGAL_NOTICE_DAYS
        ? `Antecedência de apenas ${noticeDays} dia(s) — abaixo dos ${LEGAL_NOTICE_DAYS} ` +
          `dias do art. 135 da CLT e dos ${COMPANY_NOTICE_DAYS} dias exigidos pela política interna. ` +
          `Compromete o prazo de pagamento e o repasse à folha.`
        : `Antecedência de ${noticeDays} dia(s). A política interna pede ` +
          `${COMPANY_NOTICE_DAYS} dias para garantir o fechamento da folha e o repasse à Senior.`,
    );
  }

  /* --- Sobreposição com a equipe ---------------------------------- */

  // Sem gestor E sem setor não há "equipe" definida. Sem este guard a condição
  // ficaria só "status=approved AND outro usuário", varrendo a empresa inteira
  // e reportando gente de outra área como conflito de equipe.
  const teamScope = employee.managerId
    ? eq(users.managerId, employee.managerId)
    : employee.sector
      ? eq(users.sector, employee.sector)
      : null;

  const teammates = teamScope
    ? await db
        .select({
          name: users.name,
          start: vacationRequests.startDate,
          end: vacationRequests.endDate,
        })
        .from(vacationRequests)
        .innerJoin(users, eq(users.id, vacationRequests.userId))
        .where(
          and(
            eq(vacationRequests.status, "approved"),
            ne(vacationRequests.userId, userId),
            teamScope,
          ),
        )
    : [];

  const teammatesOnVacation = teammates.filter((t) =>
    rangesOverlap(startDate, endDate, t.start, t.end),
  );

  const teamOverlap = teammatesOnVacation.length > 0;
  if (teamOverlap) {
    const list = teammatesOnVacation
      .map((t) => `${t.name} (${formatBR(t.start)} a ${formatBR(t.end)})`)
      .join("; ");
    warnings.push(
      `${teammatesOnVacation.length} pessoa(s) da mesma equipe já têm férias aprovadas no período: ${list}.`,
    );
  }

  /* --- Feriados dentro do período (informativo) ------------------- */

  const holidaysInsideRange = holidays.filter(
    (h) => h.date >= startDate && h.date <= endDate,
  );

  return {
    request: {
      startDate,
      endDate,
      days,
      abonoDays,
      startWeekday: WEEKDAY_NAME[startWeekday],
    },
    employee: {
      id: employee.id,
      name: employee.name,
      sector: employee.sector,
      admissionDate: employee.admissionDate,
      monthsSinceAdmission,
    },
    balance: {
      acquisitivePeriod,
      daysAlreadyTaken,
      daysRequested: days,
      daysRemainingAfter,
    },
    flags: {
      endBeforeStart,
      startsInThePast,
      beforeFirstAcquisitivePeriod,
      selfOverlaps,
      exceedsAnnualLimit,
      startsOnHoliday,
      startsOnWeeklyRest,
      startsWithinTwoDaysOfHoliday,
      startsWithinTwoDaysOfWeeklyRest,
      belowMinimumFraction,
      insufficientNotice,
      teamOverlap,
    },
    details: {
      startHoliday,
      blockingHoliday,
      overlappingOwnRequests,
      teammatesOnVacation,
      holidaysInsideRange,
      noticeDays,
    },
    conflicts,
    warnings,
  };
}

// Reexportados por conveniência: as telas já importam de `facts`.
export { daysBetweenInclusive, formatBR };
