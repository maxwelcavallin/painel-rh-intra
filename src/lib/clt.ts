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

/** Art. 135: comunicação ao empregado com 30 dias de antecedência. */
export const MIN_NOTICE_DAYS = 30;

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
