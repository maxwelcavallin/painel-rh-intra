/**
 * Smoke test das regras novas: abono pecuniário, dias úteis, prazo de pagamento
 * e período concessivo. Puro — sem banco, sem rede.
 *
 *   npm run test:clt2
 */

import {
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

console.log("\n— Período concessivo (arts. 134 e 137)");
// Admitido em 15/08/2022. Em 10/09/2026 o aquisitivo corrente é 2026-2027;
// o que está VENCENDO é 15/08/2025 a 14/08/2026, com concessão até 14/08/2027.
const d1 = vacationDeadlineFor("2022-08-15", "2026-09-10");
check("aquisitivo que está vencendo", d1.acquisitive, { start: "2025-08-15", end: "2026-08-14" });
check("prazo de concessão", d1.concessiveEnd, "2027-08-14");
check("ainda não venceu", d1.expired, false);

// Alguém admitido há muito tempo e que nunca tirou: em 2026 o prazo do
// período 2024-2025 já passou.
const d2 = vacationDeadlineFor("2019-03-11", "2026-08-05");
check("prazo no futuro para quem está em dia", d2.expired, false);

// Caso de vencimento: referência DEPOIS do fim do concessivo.
const d3 = vacationDeadlineFor("2022-08-15", "2027-09-01");
check("aquisitivo vencido", d3.acquisitive, { start: "2026-08-15", end: "2027-08-14" });
check("concessão até 14/08/2028", d3.concessiveEnd, "2028-08-14");

console.log(
  `\n${failed === 0 ? "✔" : "✖"} ${passed} verificações ok, ${failed} falha(s).\n`,
);
process.exit(failed === 0 ? 0 : 1);
