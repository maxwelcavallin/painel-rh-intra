import { config } from "dotenv";

config({ path: ".env.local" });

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import { db } from "../src/db";
import { cpfFicticio } from "../src/db/fake-cpf";
import { users } from "../src/db/schema";
import { isValidCpf } from "../src/lib/format";

/**
 * Cadastra a equipe real da 01 Tec para a rodada de testes.
 *
 *   npm run db:equipe
 *
 * SEPARADO DO SEED DE PROPÓSITO. `npm run db:seed` apaga a tabela de usuários
 * inteira para recompor a demonstração; se estas pessoas estivessem lá dentro,
 * qualquer reseed apagaria os acessos de quem está testando. Aqui o script é
 * idempotente por e-mail e pode rodar quantas vezes for preciso.
 *
 * NOME e E-MAIL são reais. TODO O RESTO é simulado — CPF, RG, nascimento,
 * endereço, filiação e data de admissão são preenchimento para as telas terem
 * o que mostrar, não dado de RH. Trocar pelos reais antes de qualquer uso
 * que não seja teste.
 *
 * TELEFONE fica em branco de propósito: um número inventado que por acaso
 * exista receberia mensagem de verdade pela Zaia. O RH preenche pela tela de
 * Colaboradores quando for testar o WhatsApp.
 *
 * A SENHA só é gravada na criação. Se a pessoa já existe, o script atualiza os
 * dados de cadastro e NÃO mexe na senha — quem já trocou continua com a sua.
 */

type Pessoa = {
  name: string;
  email: string;
  senha: string;
  role: "user" | "gestor" | "admin";
  sector: string;
  position: string;
  admissionDate: string;
  birthDate: string;
  cpfBase: string;
  rg: string;
  zipCode: string;
  addressStreet: string;
  addressNumber: string;
  neighborhood: string;
  city: string;
  state: string;
  isCuritibaMetro: boolean;
  educationLevel: string;
  motherName: string;
  fatherName: string;
  birthplace: string;
  gender: string;
  /** E-mail do gestor direto. Resolvido para id depois de todos existirem. */
  gestorEmail?: string;
};

/** Curitiba e Birigui — os únicos endereços informados pelo RH. */
const CURITIBA = {
  city: "Curitiba",
  state: "PR",
  isCuritibaMetro: true,
};

const EQUIPE: Pessoa[] = [
  {
    name: "Maxwel Cavallin",
    email: "maxwel.cavallin@01tec.com.br",
    senha: "Gestor01Tec@26",
    role: "gestor",
    sector: "Tecnologia",
    position: "Coordenador de Tecnologia",
    admissionDate: "2025-01-13",
    birthDate: "1990-04-22",
    cpfBase: "382914760",
    rg: "10.482.913-7",
    zipCode: "16200-175",
    addressStreet: "Rua Professora Lydia Helena Frandsen Sthur",
    addressNumber: "120",
    neighborhood: "Jardim Morumbi",
    city: "Birigui",
    state: "SP",
    isCuritibaMetro: false,
    educationLevel: "Superior completo",
    motherName: "Nome simulado",
    fatherName: "Nome simulado",
    birthplace: "Birigui/SP",
    gender: "Masculino",
  },
  {
    name: "Recursos Humanos 01 Tec",
    email: "rh@01tec.com.br",
    senha: "RH01Tec@2026",
    role: "admin",
    sector: "Recursos Humanos",
    position: "Analista de RH",
    admissionDate: "2025-03-03",
    birthDate: "1992-09-08",
    cpfBase: "417062938",
    rg: "12.907.541-3",
    zipCode: "80530-000",
    addressStreet: "Avenida Cândido de Abreu",
    addressNumber: "500",
    neighborhood: "Centro Cívico",
    ...CURITIBA,
    educationLevel: "Superior completo",
    motherName: "Nome simulado",
    fatherName: "Nome simulado",
    birthplace: "Curitiba/PR",
    gender: "Não informado",
  },
  {
    name: "Thayla Zappielo Oliveira",
    email: "thayla.oliveira@01tec.com.br",
    senha: "Thayla01Tec@26",
    role: "user",
    sector: "Tecnologia",
    position: "Analista de Produto",
    admissionDate: "2025-04-07",
    birthDate: "1997-02-19",
    cpfBase: "529183746",
    rg: "13.658.204-1",
    zipCode: "80010-010",
    addressStreet: "Rua Marechal Deodoro",
    addressNumber: "88",
    neighborhood: "Centro",
    ...CURITIBA,
    educationLevel: "Superior completo",
    motherName: "Nome simulado",
    fatherName: "Nome simulado",
    birthplace: "Curitiba/PR",
    gender: "Feminino",
    gestorEmail: "maxwel.cavallin@01tec.com.br",
  },
  {
    name: "Rafaela Nascimento",
    email: "rafaela.nascimento@01tec.com.br",
    senha: "Rafaela01Tec@26",
    role: "user",
    sector: "Tecnologia",
    position: "Analista de Qualidade",
    admissionDate: "2025-06-02",
    birthDate: "1995-11-30",
    cpfBase: "630274815",
    rg: "14.203.876-9",
    zipCode: "80420-090",
    addressStreet: "Avenida do Batel",
    addressNumber: "1440",
    neighborhood: "Batel",
    ...CURITIBA,
    educationLevel: "Superior completo",
    motherName: "Nome simulado",
    fatherName: "Nome simulado",
    birthplace: "Curitiba/PR",
    gender: "Feminino",
    gestorEmail: "maxwel.cavallin@01tec.com.br",
  },
  {
    name: "Kamilly Vitoria Melo Mateus",
    email: "kamilly.mateus@01tec.com.br",
    senha: "Kamilly01Tec@26",
    role: "user",
    sector: "Tecnologia",
    position: "Assistente de Suporte",
    admissionDate: "2025-08-11",
    birthDate: "2001-07-05",
    cpfBase: "741385902",
    rg: "15.734.019-2",
    zipCode: "82820-100",
    addressStreet: "Rua Adílio Ramos",
    addressNumber: "210",
    neighborhood: "Bairro Alto",
    ...CURITIBA,
    educationLevel: "Superior incompleto",
    motherName: "Nome simulado",
    fatherName: "Nome simulado",
    birthplace: "Curitiba/PR",
    gender: "Feminino",
    gestorEmail: "maxwel.cavallin@01tec.com.br",
  },
  {
    name: "Kauan Henrique de Jesus Kutzki",
    email: "kauan.jesus@01tec.com.br",
    senha: "Kauan01Tec@26",
    role: "user",
    sector: "Tecnologia",
    position: "Desenvolvedor Júnior",
    admissionDate: "2025-10-20",
    birthDate: "2000-03-14",
    cpfBase: "852496013",
    rg: "16.845.230-6",
    zipCode: "80010-010",
    addressStreet: "Rua Marechal Deodoro",
    addressNumber: "902",
    neighborhood: "Centro",
    ...CURITIBA,
    educationLevel: "Superior incompleto",
    motherName: "Nome simulado",
    fatherName: "Nome simulado",
    birthplace: "Curitiba/PR",
    gender: "Masculino",
    gestorEmail: "maxwel.cavallin@01tec.com.br",
  },
];

async function main() {
  // Falhar aqui, e não na tela: o formulário de edição valida o dígito
  // verificador, e um CPF mal formado deixaria o registro impossível de editar.
  for (const p of EQUIPE) {
    const cpf = cpfFicticio(p.cpfBase);
    if (!isValidCpf(cpf)) {
      throw new Error(`CPF gerado inválido para ${p.name}: ${cpf}`);
    }
  }

  const criados: string[] = [];
  const atualizados: string[] = [];

  for (const p of EQUIPE) {
    const cadastro = {
      name: p.name,
      role: p.role,
      sector: p.sector,
      position: p.position,
      admissionDate: p.admissionDate,
      employmentType: "clt" as const,
      employmentStatus: "ativo" as const,
      isActive: true,
      // Em branco de propósito — ver o cabeçalho deste arquivo.
      phone: null,
      birthDate: p.birthDate,
      cpf: cpfFicticio(p.cpfBase),
      rg: p.rg,
      zipCode: p.zipCode,
      addressStreet: p.addressStreet,
      addressNumber: p.addressNumber,
      neighborhood: p.neighborhood,
      city: p.city,
      state: p.state,
      isCuritibaMetro: p.isCuritibaMetro,
      educationLevel: p.educationLevel,
      motherName: p.motherName,
      fatherName: p.fatherName,
      birthplace: p.birthplace,
      gender: p.gender,
    };

    const [existente] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, p.email))
      .limit(1);

    if (existente) {
      // Sem `passwordHash`: quem já trocou a senha continua com a dele.
      await db.update(users).set(cadastro).where(eq(users.id, existente.id));
      atualizados.push(p.email);
    } else {
      await db.insert(users).values({
        ...cadastro,
        email: p.email,
        passwordHash: await bcrypt.hash(p.senha, 12),
      });
      criados.push(p.email);
    }
  }

  // Segunda passada: agora que todo mundo existe, amarra os gestores.
  const todos = await db.select({ id: users.id, email: users.email }).from(users);
  const idPorEmail = new Map(todos.map((u) => [u.email, u.id]));

  for (const p of EQUIPE) {
    if (!p.gestorEmail) continue;
    const gestorId = idPorEmail.get(p.gestorEmail);
    if (!gestorId) throw new Error(`Gestor ${p.gestorEmail} não encontrado.`);
    await db
      .update(users)
      .set({ managerId: gestorId })
      .where(eq(users.email, p.email));
  }

  console.log(`\n✔ ${criados.length} criado(s), ${atualizados.length} atualizado(s).`);
  if (criados.length > 0) {
    console.log("\nAcessos CRIADOS agora (senha vale só para quem é novo):");
    console.table(
      EQUIPE.filter((p) => criados.includes(p.email)).map((p) => ({
        nome: p.name,
        email: p.email,
        senha: p.senha,
        papel: { user: "Colaborador", gestor: "Gestor", admin: "RH (admin master)" }[p.role],
      })),
    );
  }
  if (atualizados.length > 0) {
    console.log(
      `\nJá existiam (cadastro atualizado, senha preservada): ${atualizados.join(", ")}`,
    );
  }
  console.log(
    "\nTelefone ficou em branco: preencha pela tela de Colaboradores antes de\n" +
      "testar o WhatsApp, senão a Zaia não tem para onde enviar.\n",
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
