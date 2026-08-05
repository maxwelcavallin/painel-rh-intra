import { config } from "dotenv";

config({ path: ".env.local" });

import { eq } from "drizzle-orm";

import { db } from "../src/db";
import { users } from "../src/db/schema";
import {
  createEmployee,
  getEmployee,
  listManagerCandidates,
  updateEmployee,
  type EmployeeInput,
} from "../src/server/employees";

/**
 * Smoke test do cadastro de colaboradores contra o banco real.
 *
 *   npm run test:colaborador
 *
 * Cobre o que a tela não consegue provar sozinha: derivação do `isCuritibaMetro`
 * no save, unicidade de e-mail, rejeição de CPF inválido e troca de senha.
 */

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

const EMAIL = "joana.teste@01tecnologia.demo";

function base(overrides: Partial<EmployeeInput> = {}): EmployeeInput {
  return {
    name: "Joana Ribeiro Salgado",
    email: EMAIL,
    role: "user",
    isActive: true,
    sector: "Tecnologia",
    position: "Designer de Produto",
    managerId: null,
    admissionDate: "2024-02-05",
    employmentType: "clt",
    employmentStatus: "ativo",
    phone: "(41) 98888-7777",
    discordHandle: null,
    personalEmail: null,
    zipCode: "83005-000",
    addressStreet: "Rua Quinze de Novembro",
    addressNumber: "120",
    addressComplement: null,
    neighborhood: "Centro",
    city: "São José dos Pinhais",
    state: "PR",
    birthDate: "1996-03-12",
    gender: "Feminino",
    rg: "19.876.543-2",
    cpf: "529.982.247-25",
    fatherName: null,
    motherName: "Vera Ribeiro",
    birthplace: "Curitiba/PR",
    educationLevel: "Superior completo",
    courseName: "Design",
    institution: "Universidade Fictícia do Paraná",
    ...overrides,
  };
}

async function main() {
  await db.delete(users).where(eq(users.email, EMAIL));

  console.log("\n— Criação");
  const criado = await createEmployee(base(), "Colab@2026");
  check("criado com sucesso", criado.ok, true);
  if (!criado.ok) throw new Error(criado.error);
  check("isCuritibaMetro derivado (São José dos Pinhais/PR)", criado.isCuritibaMetro, true);

  const salvo = await getEmployee(criado.id);
  check("flag persistido no banco", salvo?.isCuritibaMetro, true);
  check("CPF guardado só com dígitos", salvo?.cpf, "52998224725");
  check("CEP guardado só com dígitos", salvo?.zipCode, "83005000");
  check("e-mail normalizado em minúsculas", salvo?.email, EMAIL);
  check("senha gravada como hash", salvo?.passwordHash?.startsWith("$2"), true);

  console.log("\n— Validação recusa dado ruim");
  const cpfRuim = await createEmployee(
    base({ email: "outro@01tecnologia.demo", cpf: "111.111.111-11" }),
    "Colab@2026",
  );
  check("CPF repetido rejeitado", cpfRuim.ok, false);

  const cpfErrado = await createEmployee(
    base({ email: "outro@01tecnologia.demo", cpf: "529.982.247-26" }),
    "Colab@2026",
  );
  check("dígito verificador errado rejeitado", cpfErrado.ok, false);

  const duplicado = await createEmployee(base(), "Colab@2026");
  check("e-mail duplicado rejeitado", duplicado.ok, false);

  const senhaCurta = await createEmployee(
    base({ email: "outro@01tecnologia.demo" }),
    "1234",
  );
  check("senha curta rejeitada", senhaCurta.ok, false);

  console.log("\n— Edição: mudar de cidade recalcula o flag");
  const paraFora = await updateEmployee(
    criado.id,
    base({ city: "Blumenau", state: "SC", zipCode: "89010-000" }),
    null,
  );
  check("edição aceita", paraFora.ok, true);
  check("saiu da RMC", paraFora.ok && paraFora.isCuritibaMetro, false);

  const semSenhaNova = await getEmployee(criado.id);
  check("senha preservada quando o campo vem vazio", semSenhaNova?.passwordHash, salvo?.passwordHash);

  const deVolta = await updateEmployee(criado.id, base(), null);
  check("voltou para a RMC", deVolta.ok && deVolta.isCuritibaMetro, true);

  console.log("\n— Regras de gestor");
  const proprioGestor = await updateEmployee(
    criado.id,
    base({ managerId: criado.id }),
    null,
  );
  check("não pode ser gestor de si mesmo", proprioGestor.ok, false);

  const candidatos = await listManagerCandidates(criado.id);
  check("candidatos a gestor não incluem a própria pessoa", candidatos.some((c) => c.id === criado.id), false);
  check("candidatos são só gestor/admin", candidatos.length, 3);

  console.log("\n— Troca de senha");
  const comSenha = await updateEmployee(criado.id, base(), "NovaSenha@2026");
  check("aceita nova senha", comSenha.ok, true);
  const apos = await getEmployee(criado.id);
  check("hash mudou", apos?.passwordHash !== salvo?.passwordHash, true);

  await db.delete(users).where(eq(users.email, EMAIL));

  console.log(
    `\n${failed === 0 ? "✔" : "✖"} ${passed} verificações ok, ${failed} falha(s).\n`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
