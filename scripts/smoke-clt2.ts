/**
 * Smoke test das regras novas: abono pecuniário, dias úteis, prazo de pagamento
 * e período concessivo. Puro — sem banco, sem rede.
 *
 *   npm run test:clt2
 */

import {
  closedAcquisitivePeriods,
  COMPANY_NOTICE_DAYS,
  isBusinessDay,
  LEGAL_NOTICE_DAYS,
  MAX_ABONO_DAYS,
  paymentDeadline,
  subtractBusinessDays,
  vacationDeadlineFor,
  validateAbono,
} from "../src/lib/clt";

let passed = 0;
let failed = 0;

function check(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed++;
    console.log(`  ok   ${label}`);
  } else {
    failed++;
    console.error(
      `  FAIL ${label}\n         esperado: ${JSON.stringify(expected)}\n         obtido:   ${JSON.stringify(actual)}`,
    );
  }
}

function checkErro(label: string, actual: string | null, deveRejeitar: boolean) {
  const rejeitou = actual !== null;
  if (rejeitou === deveRejeitar) {
    passed++;
    console.log(`  ok   ${label}`);
  } else {
    failed++;
    console.error(`  FAIL ${label} — obtido: ${actual ?? "aceito"}`);
  }
}

console.log("\n— Política de antecedência");
check("CLT exige 30", LEGAL_NOTICE_DAYS, 30);
check("01 Tecnologia exige 40", COMPANY_NOTICE_DAYS, 40);
check("a política é mais rígida que a lei", COMPANY_NOTICE_DAYS > LEGAL_NOTICE_DAYS, true);

console.log("\n— Abono pecuniário (art. 143)");
check("teto de 10 dias", MAX_ABONO_DAYS, 10);
checkErro("sem abono é sempre válido", validateAbono({ vacationDays: 30, abonoDays: 0, daysAlreadyTaken: 0 }), false);
checkErro("20 de gozo + 10 de abono cabe", validateAbono({ vacationDays: 20, abonoDays: 10, daysAlreadyTaken: 0 }), false);
checkErro("11 dias de abono estoura o terço", validateAbono({ vacationDays: 19, abonoDays: 11, daysAlreadyTaken: 0 }), true);
checkErro("30 de gozo + 10 de abono passa de 30", validateAbono({ vacationDays: 30, abonoDays: 10, daysAlreadyTaken: 0 }), true);
checkErro("abono fracionado é rejeitado", validateAbono({ vacationDays: 20, abonoDays: 5.5, daysAlreadyTaken: 0 }), true);
checkErro("considera o que já foi usufruído", validateAbono({ vacationDays: 15, abonoDays: 10, daysAlreadyTaken: 10 }), true);

console.log("\n— Dias úteis");
// 08/08/2026 é sábado; 09/08 domingo; 10/08 segunda.
check("sábado não é dia útil", isBusinessDay("2026-08-08", new Set()), false);
check("domingo não é dia útil", isBusinessDay("2026-08-09", new Set()), false);
check("segunda é dia útil", isBusinessDay("2026-08-10", new Set()), true);
check("feriado não é dia útil", isBusinessDay("2026-08-10", new Set(["2026-08-10"])), false);

console.log("\n— Prazo de pagamento (art. 145): 2 dias ÚTEIS antes");
// Férias começando na segunda 10/08: 2 dias úteis antes = quinta 06/08,
// porque sábado e domingo não contam.
check("início na segunda recua até quinta", paymentDeadline("2026-08-10"), "2026-08-06");
// Início na quarta 12/08: 2 dias úteis antes = segunda 10/08.
check("início na quarta recua até segunda", paymentDeadline("2026-08-12"), "2026-08-10");
// Com feriado na quinta 06/08, precisa recuar mais um dia útil.
check(
  "feriado empurra o prazo para trás",
  paymentDeadline("2026-08-10", new Set(["2026-08-06"])),
  "2026-08-05",
);
check("recuar 0 dias úteis não move", subtractBusinessDays("2026-08-10", 0), "2026-08-10");

console.log("\n— Períodos fechados");
// Admitido em 15/08/2022. Em 10/09/2026 fecharam 4 ciclos:
// 22-23, 23-24, 24-25 e 25-26.
const fechados = closedAcquisitivePeriods("2022-08-15", "2026-09-10");
check("4 períodos fechados", fechados.length, 4);
check("o mais antigo", { start: fechados[0].start, end: fechados[0].end }, { start: "2022-08-15", end: "2023-08-14" });
check("concessão do mais antigo", fechados[0].concessiveEnd, "2024-08-14");
check("o mais recente", fechados[3].concessiveEnd, "2027-08-14");
check("no primeiro ano de casa não há nada fechado", closedAcquisitivePeriods("2026-03-01", "2026-08-05").length, 0);

console.log("\n— Período concessivo: prende o MAIS ANTIGO em aberto (arts. 134 e 137)");
// Quem nunca tirou nada em 2026: o período 22-23 venceu em 14/08/2024.
const nunca = vacationDeadlineFor("2022-08-15", "2026-09-10", 0);
check("prende o período de 2022-2023", nunca.acquisitive, { start: "2022-08-15", end: "2023-08-14" });
check("prazo era 14/08/2024", nunca.concessiveEnd, "2024-08-14");
check("VENCIDO", nunca.expired, true);
check("dias negativos", nunca.daysUntilDeadline < 0, true);
check("30 dias em aberto nesse período", nunca.daysRemainingInPeriod, 30);

// Quem já tirou 90 dias quitou os três primeiros períodos; prende o quarto.
const tresQuitados = vacationDeadlineFor("2022-08-15", "2026-09-10", 90);
check("prende o período de 2025-2026", tresQuitados.acquisitive, { start: "2025-08-15", end: "2026-08-14" });
check("prazo 14/08/2027", tresQuitados.concessiveEnd, "2027-08-14");
check("não venceu", tresQuitados.expired, false);

// Quem tirou 45 dias quitou o primeiro e usou 15 do segundo.
const meio = vacationDeadlineFor("2022-08-15", "2026-09-10", 45);
check("prende o segundo período", meio.acquisitive, { start: "2023-08-15", end: "2024-08-14" });
check("restam 15 dias nele", meio.daysRemainingInPeriod, 15);
check("também já venceu", meio.expired, true);

// Quem tirou os 120 dias dos quatro períodos está quite.
const quite = vacationDeadlineFor("2022-08-15", "2026-09-10", 120);
check("quitado", quite.settled, true);
check("não venceu nada", quite.expired, false);
check("nada em aberto", quite.daysRemainingInPeriod, 0);

// Primeiro ano de casa: direito ainda nem nasceu.
const novato = vacationDeadlineFor("2026-03-01", "2026-08-05", 0);
check("novato não tem prazo correndo", novato.settled, true);
check("novato não está vencido", novato.expired, false);

console.log(
  `\n${failed === 0 ? "✔" : "✖"} ${passed} verificações ok, ${failed} falha(s).\n`,
);
process.exit(failed === 0 ? 0 : 1);
