import { config } from "dotenv";

config({ path: ".env.local" });

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import { db } from "../src/db";
import { cpfFicticio } from "../src/db/fake-cpf";
import { users, vacationRequests } from "../src/db/schema";
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

/**
 * Senha inicial de cada pessoa — lida do ambiente, NUNCA escrita aqui.
 *
 * O repositório é público. Estas contas dão acesso real ao sistema, inclusive
 * a de RH, que é admin master e enxerga CPF, RG e endereço de todo mundo.
 * Senha em arquivo versionado é senha entregue a quem abrir o GitHub.
 *
 * Moram em `.env.local`, que o git ignora. Veja `.env.example` para a lista.
 */
function senhaDe(variavel: string): string {
  const valor = process.env[variavel];
  if (!valor) {
    throw new Error(
      `Falta ${variavel} no .env.local. As senhas da equipe não moram mais no ` +
        `código — veja .env.example para a lista completa.`,
    );
  }
  return valor;
}

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
    senha: senhaDe("EQUIPE_SENHA_MAXWEL"),
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
    senha: senhaDe("EQUIPE_SENHA_RH"),
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
    senha: senhaDe("EQUIPE_SENHA_THAYLA"),
    role: "user",
    sector: "Tecnologia",
    position: "Analista de Produto",
    admissionDate: "2021-06-14",
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
    senha: senhaDe("EQUIPE_SENHA_RAFAELA"),
    role: "user",
    sector: "Tecnologia",
    position: "Analista de Qualidade",
    admissionDate: "2023-09-05",
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
    senha: senhaDe("EQUIPE_SENHA_KAMILLY"),
    role: "user",
    sector: "Tecnologia",
    position: "Assistente de Suporte",
    admissionDate: "2022-10-20",
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
    senha: senhaDe("EQUIPE_SENHA_KAUAN"),
    role: "user",
    sector: "Tecnologia",
    position: "Desenvolvedor Júnior",
    admissionDate: "2024-02-12",
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


/**
 * Histórico de férias da equipe — o que dá matéria ao parecer.
 *
 * Sem histórico, a análise de risco do gestor não tem o que dizer: quatro
 * pessoas admitidas ontem estão todas "em dia" e o parecer sai vazio, com razão.
 * Estes registros produzem, em 05/08/2026, o espectro completo dentro da equipe
 * do Maxwel — uma vencida, uma crítica, uma em atenção e uma em dia — e trazem
 * padrões que o modelo consegue ler: sazonalidade, cancelamentos repetidos,
 * venda de abono e pendência de pagamento.
 *
 * FICTÍCIO, como o resto do cadastro. Reescrito a cada `db:equipe`.
 */
type Ferias = {
  inicio: string;
  fim: string;
  dias: number;
  abono?: number;
  /** Guarda a DATA do cancelamento, não um booleano. */
  cancelada?: string;
  antecipa13?: boolean;
  pagarAte?: string;
  pago?: boolean;
  reciboAssinado?: boolean;
};

const HISTORICO: Record<string, Ferias[]> = {
  // Admitida em 2021: tirou uma vez e depois cancelou duas seguidas. O período
  // 2022-2023 venceu em 13/06/2024 sem ninguém notar.
  "thayla.oliveira@01tec.com.br": [
    { inicio: "2022-11-07", fim: "2022-12-06", dias: 30 },
    { inicio: "2024-03-04", fim: "2024-04-02", dias: 30, cancelada: "2024-02-20" },
    { inicio: "2025-03-03", fim: "2025-04-01", dias: 30, cancelada: "2025-02-25" },
  ],
  // Vendeu 10 dias de abono na única vez que tirou. Prazo aperta em 04/09/2026.
  "rafaela.nascimento@01tec.com.br": [
    { inicio: "2025-01-06", fim: "2025-01-25", dias: 20, abono: 10, antecipa13: true },
  ],
  // Duas férias em janeiro, sempre no mesmo mês — padrão que colide com o
  // prazo de outubro.
  "kamilly.mateus@01tec.com.br": [
    { inicio: "2024-01-08", fim: "2024-02-06", dias: 30 },
    { inicio: "2025-01-06", fim: "2025-02-04", dias: 30 },
  ],
  // Em dia e com férias já marcadas — mas o pagamento continua em aberto.
  "kauan.jesus@01tec.com.br": [
    { inicio: "2025-07-07", fim: "2025-08-05", dias: 30 },
    { inicio: "2026-09-21", fim: "2026-10-05", dias: 15, pagarAte: "2026-09-17" },
  ],
};

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

  console.log("Recompondo o histórico de férias da equipe…");
  let linhas = 0;
  for (const [email, ferias] of Object.entries(HISTORICO)) {
    const userId = idPorEmail.get(email);
    if (!userId) throw new Error(`Sem usuário para ${email}.`);

    // Apaga e regrava: o script é idempotente, e acumular duplicata a cada
    // execução falsearia o saldo de dias usufruídos.
    await db.delete(vacationRequests).where(eq(vacationRequests.userId, userId));
    if (ferias.length === 0) continue;

    await db.insert(vacationRequests).values(
      ferias.map((f) => ({
        userId,
        startDate: f.inicio,
        endDate: f.fim,
        days: f.dias,
        abonoPecuniario: (f.abono ?? 0) > 0,
        abonoDays: f.abono ?? 0,
        advance13th: f.antecipa13 ?? false,
        status: f.cancelada ? ("cancelled" as const) : ("approved" as const),
        rhApproval: "approved" as const,
        managerApproval: "approved" as const,
        cancelledAt: f.cancelada ? new Date(`${f.cancelada}T12:00:00Z`) : null,
        cancelReason: f.cancelada ? "Remanejada por necessidade da operação." : null,
        paymentDueDate: f.pagarAte ?? null,
        paidAt: f.pago ? new Date(`${f.inicio}T12:00:00Z`) : null,
        receiptSignedAt: f.reciboAssinado ? new Date(`${f.inicio}T12:00:00Z`) : null,
      })),
    );
    linhas += ferias.length;
  }
  console.log(`✔ ${linhas} registro(s) de férias gravado(s).`);

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
