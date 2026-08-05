/**
 * Smoke test do cadastro: RMC, validação de CPF e mascaramento de dado sensível.
 * Puro — sem banco, sem rede.
 *
 *   npm run test:cadastro
 */

import {
  formatCep,
  formatPhone,
  isValidCpf,
  maskCpf,
  maskRg,
  onlyDigits,
} from "../src/lib/format";
import { isCuritibaMetro, normalizeCity, RMC_MUNICIPALITIES } from "../src/lib/rmc";

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

console.log("\n— Região Metropolitana de Curitiba");
check("são 29 municípios", RMC_MUNICIPALITIES.length, 29);
check("Curitiba/PR", isCuritibaMetro("Curitiba", "PR"), true);
check("São José dos Pinhais/PR", isCuritibaMetro("São José dos Pinhais", "PR"), true);
check("Pinhais/PR", isCuritibaMetro("Pinhais", "PR"), true);
check("Piraquara/PR", isCuritibaMetro("Piraquara", "PR"), true);
check("Campo Largo/PR", isCuritibaMetro("Campo Largo", "PR"), true);

console.log("\n— Tolerância a acento e caixa (a ViaCEP devolve com acento)");
check("sem acento", isCuritibaMetro("Sao Jose dos Pinhais", "PR"), true);
check("caixa alta", isCuritibaMetro("ARAUCÁRIA", "PR"), true);
check("espaço extra", isCuritibaMetro("  Almirante  Tamandaré ", "PR"), true);
check("normalizeCity", normalizeCity("São José dos Pinhais"), "sao jose dos pinhais");

console.log("\n— Fora da RMC");
check("Blumenau/SC", isCuritibaMetro("Blumenau", "SC"), false);
check("Londrina/PR (PR mas não RMC)", isCuritibaMetro("Londrina", "PR"), false);
check("Maringá/PR", isCuritibaMetro("Maringá", "PR"), false);
check("cidade vazia", isCuritibaMetro("", "PR"), false);
check("UF ausente", isCuritibaMetro("Curitiba", null), false);

console.log("\n— A UF importa: homônimos fora do Paraná");
// Existe Lapa em SP e Rio Negro em SC — nenhuma das duas é da RMC.
check("Lapa/PR está na RMC", isCuritibaMetro("Lapa", "PR"), true);
check("Lapa/SP NÃO está", isCuritibaMetro("Lapa", "SP"), false);
check("Rio Negro/PR está", isCuritibaMetro("Rio Negro", "PR"), true);
check("Rio Negro/SC NÃO está", isCuritibaMetro("Rio Negro", "SC"), false);

console.log("\n— Validação de CPF (dígito verificador)");
check("CPF válido do seed", isValidCpf("529.982.247-25"), true);
check("mesmo CPF só com dígitos", isValidCpf("52998224725"), true);
check("último dígito errado", isValidCpf("529.982.247-26"), false);
check("todos repetidos", isValidCpf("111.111.111-11"), false);
check("curto demais", isValidCpf("1234567890"), false);
check("vazio", isValidCpf(""), false);

console.log("\n— Mascaramento de dado sensível");
check("CPF mascarado", maskCpf("529.982.247-25"), "***.***.247-25");
check("CPF nulo", maskCpf(null), "—");
// "10.234.567-8" tem 12 caracteres → 9 asteriscos + os 3 últimos.
check("RG mascarado", maskRg("10.234.567-8"), "*********7-8");
check("RG curto", maskRg("12"), "***");

console.log("\n— Formatação");
check("CEP", formatCep("80010010"), "80010-010");
check("celular", formatPhone("41999998888"), "(41) 99999-8888");
check("celular com DDI", formatPhone("5541999998888"), "(41) 99999-8888");
check("fixo", formatPhone("4133334444"), "(41) 3333-4444");
check("só dígitos", onlyDigits("(41) 99999-8888"), "41999998888");

console.log(
  `\n${failed === 0 ? "✔" : "✖"} ${passed} verificações ok, ${failed} falha(s).\n`,
);
process.exit(failed === 0 ? 0 : 1);
