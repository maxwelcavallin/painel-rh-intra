/**
 * Regras da CLT e aritmética de datas — funções PURAS, sem banco e sem rede.
 *
 * Separado de `facts.ts` de propósito: o bloqueio do art. 134, §3º reprova
 * solicitação de férias, então precisa ser verificável sozinho, sem subir banco.
 * Ver `scripts/smoke-clt.ts`.
 *
 * Tudo opera em string ISO `YYYY-MM-DD` e Date em UTC. Nunca usar Date local
 * aqui: fuso do servidor deslocaria a data e a regra dos "dois dias antes"
 * passaria a valer para o dia errado.
 */

/* ------------------------------------------------------------------ */
/* Constantes legais                                                   */
/* ------------------------------------------------------------------ */

/** Art. 130: 30 dias corridos por período aquisitivo (jornada integral). */
export const MAX_DAYS_PER_PERIOD = 30;

/** Art. 134 §1º: ao fracionar, um período tem 14+ dias e os demais 5+. */
export const MIN_LONGEST_FRACTION = 14;
export const MIN_ANY_FRACTION = 5;

/** Art. 135 CLT: comunicação ao empregado com 30 dias de antecedência. */
export const LEGAL_NOTICE_DAYS = 30;

/**
 * Política da 01 Tecnologia: 40 dias, mais rígida que a CLT.
 *
 * Existe porque o repasse à Senior sai em lote nos dias 10 e 20, e a folha
 * precisa fechar antes. Os 30 dias legais não dão essa folga.
 * Confirmado pelo RH em 04/08/2026.
 */
export const COMPANY_NOTICE_DAYS = 40;

/**
 * Art. 143 CLT: o empregado pode converter até 1/3 das férias em dinheiro.
 * Sobre os 30 dias do período, o teto é 10.
 */
export const MAX_ABONO_DAYS = 10;

/**
 * Art. 145 CLT: o pagamento é devido até 2 dias ANTES do início das férias.
 * É aqui que a multa mora — não na aprovação.
 */
export const PAYMENT_DAYS_BEFORE = 2;

/**
 * Art. 134: as férias devem ser concedidas nos 12 meses SEGUINTES ao fim do
 * período aquisitivo (período concessivo). Passou disso, art. 137: pagamento
 * em dobro.
 */
export const CONCESSIVE_MONTHS = 12;

/** Dia de repouso semanal remunerado. 0 = domingo. */
export const WEEKLY_REST_DAY = 0;

/**
 * Art. 134 §3º: "É vedado o início das férias no período de dois dias que
 * antecede feriado ou dia de repouso semanal remunerado."
 *
 * `false` (DECIDIDO) = leitura literal: com DSR no domingo, bloqueia início na
 * sexta e no sábado. Confirmado pelo RH em 04/08/2026: "o início das férias na
 * quinta-feira é válido por regra geral, desde que o DSR caia no domingo e não
 * haja feriado próximo". A segunda metade dessa condição é justamente o outro
 * fato (`startsWithinTwoDaysOfHoliday`), checado à parte contra a lista de
 * feriados — então uma quinta véspera de feriado continua bloqueada.
 *
 * `true` = leitura mais rígida de parte dos escritórios trabalhistas: em empresa
 * que não trabalha aos sábados, o sábado também é descanso, então a quinta cai
 * nos "dois dias antes" dele. Mantido como interruptor caso a escala mude.
 */
export const STRICT_SATURDAY_AS_REST = false;

export const WEEKDAY_NAME = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
] as const;

/* ------------------------------------------------------------------ */
/* Datas                                                               */
/* ------------------------------------------------------------------ */

export function toUTC(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
  return toISO(new Date(toUTC(isoDate).getTime() + days * 86_400_000));
}

export function daysBetweenInclusive(startISO: string, endISO: string): number {
  const diff = toUTC(endISO).getTime() - toUTC(startISO).getTime();
  return Math.floor(diff / 86_400_000) + 1;
}

export function weekdayOf(isoDate: string): number {
  return toUTC(isoDate).getUTCDay();
}

export function formatBR(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

export function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

/* ------------------------------------------------------------------ */
/* Art. 134 §3º                                                        */
/* ------------------------------------------------------------------ */

/** Dias da semana em que iniciar férias é vedado pelo DSR. */
export function blockedStartWeekdays(
  strictSaturdayAsRest = STRICT_SATURDAY_AS_REST,
): number[] {
  // Dois dias antes do domingo = sexta (5) e sábado (6).
  // Na leitura estrita, o sábado também é descanso → dois dias antes dele
  // acrescenta a quinta (4).
  return strictSaturdayAsRest ? [4, 5, 6] : [5, 6];
}

export function startsWithinTwoDaysOfWeeklyRest(
  startISO: string,
  strictSaturdayAsRest = STRICT_SATURDAY_AS_REST,
): boolean {
  return blockedStartWeekdays(strictSaturdayAsRest).includes(weekdayOf(startISO));
}

/** As duas datas cujo feriado impediria um início em `startISO`. */
export function twoDaysAfter(startISO: string): [string, string] {
  return [addDays(startISO, 1), addDays(startISO, 2)];
}

/* ------------------------------------------------------------------ */
/* Período aquisitivo                                                  */
/* ------------------------------------------------------------------ */

export type AcquisitivePeriod = { start: string; end: string };

/**
 * Ciclo de 12 meses contado da admissão que contém `refISO`.
 * Ex.: admitido em 15/08/2022, referência 10/09/2026 → 15/08/2026 a 14/08/2027.
 */
export function acquisitivePeriodFor(
  admissionISO: string,
  refISO: string,
): AcquisitivePeriod {
  const admission = toUTC(admissionISO);
  const ref = toUTC(refISO);

  let cycles = ref.getUTCFullYear() - admission.getUTCFullYear();

  const anniversaryThisYear = Date.UTC(
    admission.getUTCFullYear() + cycles,
    admission.getUTCMonth(),
    admission.getUTCDate(),
  );
  if (ref.getTime() < anniversaryThisYear) cycles -= 1;
  if (cycles < 0) cycles = 0;

  const start = new Date(
    Date.UTC(
      admission.getUTCFullYear() + cycles,
      admission.getUTCMonth(),
      admission.getUTCDate(),
    ),
  );
  const end = new Date(
    Date.UTC(
      admission.getUTCFullYear() + cycles + 1,
      admission.getUTCMonth(),
      admission.getUTCDate() - 1,
    ),
  );

  return { start: toISO(start), end: toISO(end) };
}

/* ------------------------------------------------------------------ */
/* Páscoa e feriados móveis                                            */
/* ------------------------------------------------------------------ */

/** Domingo de Páscoa — algoritmo de Meeus/Jones/Butcher (gregoriano). */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

export function addDaysToDate(base: Date, days: number): string {
  return toISO(new Date(base.getTime() + days * 86_400_000));
}

/* ------------------------------------------------------------------ */
/* Dias úteis e prazo de pagamento (art. 145)                          */
/* ------------------------------------------------------------------ */

export function isBusinessDay(isoDate: string, holidays: Set<string>): boolean {
  const weekday = weekdayOf(isoDate);
  if (weekday === 0 || weekday === 6) return false;
  return !holidays.has(isoDate);
}

/**
 * Recua `count` dias ÚTEIS a partir de `isoDate`, pulando fim de semana e feriado.
 *
 * Usado para achar a data-limite de pagamento das férias. Contar em dias
 * corridos daria uma data que cai num sábado ou feriado — e o dinheiro não
 * entra na conta em dia não útil, que é exatamente como a multa acontece.
 */
export function subtractBusinessDays(
  isoDate: string,
  count: number,
  holidays: Set<string> = new Set(),
): string {
  let cursor = isoDate;
  let remaining = count;

  // Teto de segurança: 60 iterações cobrem qualquer emenda de feriado real.
  for (let guard = 0; guard < 60 && remaining > 0; guard++) {
    cursor = addDays(cursor, -1);
    if (isBusinessDay(cursor, holidays)) remaining--;
  }

  return cursor;
}

/** Data-limite para o pagamento das férias começadas em `startISO`. */
export function paymentDeadline(
  startISO: string,
  holidays: Set<string> = new Set(),
): string {
  return subtractBusinessDays(startISO, PAYMENT_DAYS_BEFORE, holidays);
}

/* ------------------------------------------------------------------ */
/* Abono pecuniário (art. 143)                                         */
/* ------------------------------------------------------------------ */

/**
 * Valida o abono contra o saldo do período.
 *
 * Duas regras somadas: o abono não passa de 1/3 (10 dias), e gozo + abono não
 * podem ultrapassar os 30 dias do período aquisitivo.
 */
export function validateAbono(params: {
  vacationDays: number;
  abonoDays: number;
  daysAlreadyTaken: number;
}): string | null {
  const { vacationDays, abonoDays, daysAlreadyTaken } = params;

  if (abonoDays <= 0) return null;
  if (!Number.isInteger(abonoDays)) return "Os dias de abono precisam ser inteiros.";

  if (abonoDays > MAX_ABONO_DAYS) {
    return `O abono pecuniário é limitado a ${MAX_ABONO_DAYS} dias — um terço do período (art. 143 da CLT).`;
  }

  const total = daysAlreadyTaken + vacationDays + abonoDays;
  if (total > MAX_DAYS_PER_PERIOD) {
    return (
      `Gozo mais abono somam ${total} dias e ultrapassam os ${MAX_DAYS_PER_PERIOD} ` +
      `do período aquisitivo. Já usufruídos: ${daysAlreadyTaken}.`
    );
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Período concessivo e vencimento (arts. 134 e 137)                   */
/* ------------------------------------------------------------------ */

export type ClosedPeriod = AcquisitivePeriod & {
  /** Último dia para CONCEDER as férias deste período sem pagar em dobro. */
  concessiveEnd: string;
};

/** Soma 12 meses a uma data ISO, preservando o dia. */
function addOneYear(isoDate: string): string {
  const d = toUTC(isoDate);
  return toISO(
    new Date(Date.UTC(d.getUTCFullYear() + 1, d.getUTCMonth(), d.getUTCDate())),
  );
}

/**
 * Todos os períodos aquisitivos que já FECHARAM, do mais antigo ao mais novo,
 * cada um com seu prazo de concessão (12 meses após o fechamento).
 */
export function closedAcquisitivePeriods(
  admissionISO: string,
  todayISO: string,
): ClosedPeriod[] {
  const periods: ClosedPeriod[] = [];
  let cursor = admissionISO;

  // Teto de 60 ciclos: cobre uma carreira inteira e impede laço infinito se
  // uma data vier corrompida.
  for (let guard = 0; guard < 60; guard++) {
    const period = acquisitivePeriodFor(admissionISO, cursor);
    if (period.end >= todayISO) break; // ainda em curso
    periods.push({ ...period, concessiveEnd: addOneYear(period.end) });
    cursor = addDays(period.end, 1);
  }

  return periods;
}

export type VacationDeadline = {
  /** O período que está prendendo — o mais antigo ainda não quitado. */
  acquisitive: AcquisitivePeriod;
  concessiveEnd: string;
  /** Dias até o limite. Negativo = já venceu. */
  daysUntilDeadline: number;
  expired: boolean;
  /** Dias que faltam usufruir do período que prende. */
  daysRemainingInPeriod: number;
  /** Todos os períodos fechados, para a tela mostrar o histórico. */
  closedPeriods: ClosedPeriod[];
  /** Nada em aberto: tudo que venceu já foi usufruído. */
  settled: boolean;
};

/**
 * Prazo que de fato prende o RH.
 *
 * Não é o período mais recente que fechou — esse tem sempre 12 meses pela
 * frente e nunca estaria vencido. É o MAIS ANTIGO ainda não quitado.
 *
 * Os períodos são consumidos em ordem (FIFO): 45 dias usufruídos quitam o
 * primeiro período inteiro e deixam 15 no segundo. Por isso o cálculo precisa
 * de `daysAlreadyTaken`, que só o banco sabe.
 */
export function vacationDeadlineFor(
  admissionISO: string,
  todayISO: string,
  daysAlreadyTaken = 0,
): VacationDeadline {
  const closedPeriods = closedAcquisitivePeriods(admissionISO, todayISO);

  // Ainda no primeiro período aquisitivo: não há prazo de concessão correndo.
  if (closedPeriods.length === 0) {
    const current = acquisitivePeriodFor(admissionISO, todayISO);
    const concessiveEnd = addOneYear(current.end);
    return {
      acquisitive: current,
      concessiveEnd,
      daysUntilDeadline: daysBetweenInclusive(todayISO, concessiveEnd) - 1,
      expired: false,
      daysRemainingInPeriod: 0,
      closedPeriods,
      settled: true,
    };
  }

  const fullyCovered = Math.floor(daysAlreadyTaken / MAX_DAYS_PER_PERIOD);

  // Tudo que venceu já foi usufruído — o relógio não está correndo.
  if (fullyCovered >= closedPeriods.length) {
    const last = closedPeriods[closedPeriods.length - 1];
    return {
      acquisitive: { start: last.start, end: last.end },
      concessiveEnd: last.concessiveEnd,
      daysUntilDeadline: daysBetweenInclusive(todayISO, last.concessiveEnd) - 1,
      expired: false,
      daysRemainingInPeriod: 0,
      closedPeriods,
      settled: true,
    };
  }

  const binding = closedPeriods[fullyCovered];
  const usedInBinding = daysAlreadyTaken - fullyCovered * MAX_DAYS_PER_PERIOD;
  const daysUntilDeadline =
    daysBetweenInclusive(todayISO, binding.concessiveEnd) - 1;

  return {
    acquisitive: { start: binding.start, end: binding.end },
    concessiveEnd: binding.concessiveEnd,
    daysUntilDeadline,
    expired: daysUntilDeadline < 0,
    daysRemainingInPeriod: MAX_DAYS_PER_PERIOD - usedInBinding,
    closedPeriods,
    settled: false,
  };
}
