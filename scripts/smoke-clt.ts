/**
 * Smoke test das regras da CLT e dos feriados.
 *
 * Roda sem banco e sem rede: só as funções puras de `@/lib/clt` e as tabelas
 * estáticas de `@/server/holidays`. É a rede de proteção da regra que REPROVA
 * solicitação (art. 134, §3º) — se algo aqui quebrar, gente vai ser barrada
 * (ou liberada) indevidamente.
 *
 *   npm run test:clt
 */

import {
  acquisitivePeriodFor,
  addDays,
  blockedStartWeekdays,
  daysBetweenInclusive,
  easterSunday,
  formatBR,
  rangesOverlap,
  startsOnHoliday,
  startsOnWeeklyRest,
  startsWithinTwoDaysOfWeeklyRest,
  toISO,
  twoDaysAfter,
  vacationStartBlock,
  weekdayOf,
  WEEKDAY_NAME,
} from "../src/lib/clt";
import {
  mergeHolidays,
  nationalHolidaysLocal,
  regionalHolidays,
} from "../src/server/holidays";

let passed = 0;
let failed = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
    console.log(`  ok   ${label}`);
  } else {
    failed++;
    console.error(`  FAIL ${label}\n         esperado: ${e}\n         obtido:   ${a}`);
  }
}

console.log("\n— Aritmética de data (UTC, sem deslocamento de fuso)");
check("dias inclusivos 01/01 a 01/01", daysBetweenInclusive("2026-01-01", "2026-01-01"), 1);
check("dias inclusivos 01/01 a 30/01", daysBetweenInclusive("2026-01-01", "2026-01-30"), 30);
check("addDays atravessa o ano", addDays("2026-12-30", 3), "2027-01-02");
check("addDays negativo", addDays("2026-03-01", -1), "2026-02-28");
check("formatBR", formatBR("2026-08-07"), "07/08/2026");
check("sobreposição encostando", rangesOverlap("2026-01-01", "2026-01-10", "2026-01-10", "2026-01-20"), true);
check("sem sobreposição", rangesOverlap("2026-01-01", "2026-01-10", "2026-01-11", "2026-01-20"), false);

console.log("\n— Páscoa e feriados móveis (2026)");
// Páscoa 2026 = 05/04/2026 (domingo).
check("Páscoa 2026", toISO(easterSunday(2026)), "2026-04-05");
const nac2026 = nationalHolidaysLocal(2026);
const byName = (n: string) => nac2026.filter((h) => h.name === n).map((h) => h.date);
check("Carnaval 2026 (seg e ter)", byName("Carnaval"), ["2026-02-16", "2026-02-17"]);
check("Sexta-feira Santa 2026", byName("Sexta-feira Santa"), ["2026-04-03"]);
// Bate com a data confirmada pelo RH no plano: 04/06/2026.
check("Corpus Christi 2026", byName("Corpus Christi"), ["2026-06-04"]);

console.log("\n— Feriados PR / Curitiba (2026)");
const reg2026 = regionalHolidays(2026);
const regDates = reg2026.map((h) => h.date);
// Lei Municipal 3.015/67: os feriados de Curitiba são Sexta-feira da Paixão
// (nacional), Corpus Christi e 8 de setembro. O aniversário da cidade não é
// feriado — é ponto facultativo.
check("N. Sra. da Luz dos Pinhais é feriado", regDates.includes("2026-09-08"), true);
check("Corpus Christi entra como municipal", regDates.includes("2026-06-04"), true);
check("Emancipação do Paraná (Lei 18.384/2014)", regDates.includes("2026-12-19"), true);
check("Aniversário de Curitiba está na lista", regDates.includes("2026-03-29"), true);
check(
  "…mas marcado como ponto facultativo",
  reg2026.find((h) => h.date === "2026-03-29")?.optional,
  true,
);
check(
  "Carnaval também é ponto facultativo",
  nac2026.filter((h) => h.name === "Carnaval").every((h) => h.optional === true),
  true,
);
check(
  "merge deduplica por data",
  mergeHolidays([nac2026, regionalHolidays(2026)]).filter((h) => h.date === "2026-06-04").length,
  1,
);
check(
  "a primeira lista vence o empate (Corpus Christi fica municipal)",
  mergeHolidays([regionalHolidays(2026), nac2026]).find((h) => h.date === "2026-06-04")?.scope,
  "municipal",
);

console.log("\n— Art. 134 §3º · repouso semanal (leitura literal, DSR no domingo)");
check("bloqueia sexta e sábado", blockedStartWeekdays(false), [5, 6]);
// 07/08/2026 é uma sexta-feira.
check("07/08/2026 é sexta", WEEKDAY_NAME[weekdayOf("2026-08-07")], "sexta-feira");
check("início na sexta é vedado", startsWithinTwoDaysOfWeeklyRest("2026-08-07", false), true);
check("início no sábado é vedado", startsWithinTwoDaysOfWeeklyRest("2026-08-08", false), true);
check("domingo não é 'véspera' de domingo", startsWithinTwoDaysOfWeeklyRest("2026-08-09", false), false);
check("início na segunda é permitido", startsWithinTwoDaysOfWeeklyRest("2026-08-10", false), false);
check("início na quinta é permitido (leitura literal)", startsWithinTwoDaysOfWeeklyRest("2026-08-06", false), false);
// …mas o domingo é o próprio DSR: as férias precisam começar em dia útil.
check("domingo é o próprio DSR", startsOnWeeklyRest("2026-08-09"), true);
check("segunda não é DSR", startsOnWeeklyRest("2026-08-10"), false);

console.log("\n— Art. 134 §3º · leitura estrita (sábado também é descanso)");
check("bloqueia quinta, sexta e sábado", blockedStartWeekdays(true), [4, 5, 6]);
check("início na quinta é vedado (leitura estrita)", startsWithinTwoDaysOfWeeklyRest("2026-08-06", true), true);
check("início na quarta segue permitido", startsWithinTwoDaysOfWeeklyRest("2026-08-05", true), false);

console.log("\n— Art. 134 §3º · feriado nos dois dias seguintes ao início");
// Natal 2026 = 25/12 (sexta). Iniciar em 23/12 ou 24/12 é vedado.
check("janela de bloqueio a partir de 23/12", twoDaysAfter("2026-12-23"), ["2026-12-24", "2026-12-25"]);
const natal = "2026-12-25";
check("23/12 é bloqueado pelo Natal", twoDaysAfter("2026-12-23").includes(natal), true);
check("24/12 é bloqueado pelo Natal", twoDaysAfter("2026-12-24").includes(natal), true);
check("22/12 não é bloqueado pelo Natal", twoDaysAfter("2026-12-22").includes(natal), false);
// Feriado municipal também conta — Emancipação do PR em 19/12/2026.
check("17/12 é bloqueado pela Emancipação do PR", twoDaysAfter("2026-12-17").includes("2026-12-19"), true);
// Virada de ano: início em 30/12 é bloqueado pelo 01/01 do ano seguinte.
check("30/12 é bloqueado pelo 01/01", twoDaysAfter("2026-12-30").includes("2027-01-01"), true);

console.log("\n— Início EM CIMA de feriado: as férias começam em dia útil");
const feriados2026 = new Set(
  mergeHolidays([regionalHolidays(2026), nationalHolidaysLocal(2026)]).map((h) => h.date),
);
// 12/10/2026 (N. Sra. Aparecida) é uma segunda-feira: passava por todas as
// checagens antigas e virava solicitação pendente.
check("12/10/2026 é segunda", WEEKDAY_NAME[weekdayOf("2026-10-12")], "segunda-feira");
check("12/10/2026 é feriado", startsOnHoliday("2026-10-12", feriados2026), true);
check("13/10/2026 não é feriado", startsOnHoliday("2026-10-13", feriados2026), false);

console.log("\n— vacationStartBlock: o predicado único de início válido");
check("feriado no próprio dia", vacationStartBlock("2026-10-12", feriados2026), "holiday");
check("domingo", vacationStartBlock("2026-08-09", feriados2026), "weekly-rest");
check("véspera de feriado (23/12, Natal na sexta)", vacationStartBlock("2026-12-23", feriados2026), "before-holiday");
check("sexta-feira comum", vacationStartBlock("2026-08-07", feriados2026), "before-weekly-rest");
check("segunda-feira comum é liberada", vacationStartBlock("2026-08-10", feriados2026), null);
check("quinta-feira comum é liberada", vacationStartBlock("2026-08-06", feriados2026), null);
// Segunda-feira de Carnaval: só existe na lista local, e é o dia que sumia
// quando a BrasilAPI respondia (ela devolve só a terça).
check("16/02/2026 é a segunda de Carnaval", feriados2026.has("2026-02-16"), true);
check("início na segunda de Carnaval é vedado", vacationStartBlock("2026-02-16", feriados2026), "holiday");
// Quinta 12/02 fica a dois dias da segunda 16/02? Não — 13 e 14. Mas a
// quinta 11/02 não encosta em nada, e a sexta cai na regra do DSR.
check("quarta 11/02 é liberada", vacationStartBlock("2026-02-11", feriados2026), null);

console.log("\n— Período aquisitivo (art. 130)");
check(
  "admissão 15/08/2022, referência 10/09/2026",
  acquisitivePeriodFor("2022-08-15", "2026-09-10"),
  { start: "2026-08-15", end: "2027-08-14" },
);
check(
  "referência antes do aniversário volta um ciclo",
  acquisitivePeriodFor("2022-08-15", "2026-08-14"),
  { start: "2025-08-15", end: "2026-08-14" },
);
check(
  "no dia exato do aniversário abre ciclo novo",
  acquisitivePeriodFor("2022-08-15", "2026-08-15"),
  { start: "2026-08-15", end: "2027-08-14" },
);
check(
  "primeiro ano de casa",
  acquisitivePeriodFor("2026-03-01", "2026-07-01"),
  { start: "2026-03-01", end: "2027-02-28" },
);

console.log(
  `\n${failed === 0 ? "✔" : "✖"} ${passed} verificações ok, ${failed} falha(s).\n`,
);
process.exit(failed === 0 ? 0 : 1);
