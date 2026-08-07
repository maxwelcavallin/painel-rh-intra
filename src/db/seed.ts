import { config } from "dotenv";

config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import bcrypt from "bcryptjs";

import {
  addDays,
  closedAcquisitivePeriods,
  MAX_DAYS_PER_PERIOD,
} from "../lib/clt";
import { isValidCpf } from "../lib/format";

import { cpfFicticio } from "./fake-cpf";

import * as schema from "./schema";
import {
  broadcastDeliveries,
  broadcasts,
  formResponses,
  forms,
  institutionalEvents,
  notificationSettings,
  notifications,
  passwordResetCodes,
  users,
  vacationRequests,
} from "./schema";

/**
 * Seed 100% FICTÍCIO — é um dos checkboxes da ficha de entrega.
 * Nenhum nome, CPF, RG, endereço ou telefone aqui corresponde a pessoa real.
 * CPFs foram gerados com dígito verificador válido apenas para o formulário
 * aceitar; não pertencem a ninguém.
 */

const db = drizzle(neon(process.env.DATABASE_URL!), { schema });

/**
 * Senhas dos usuários de demonstração — vêm do ambiente, NUNCA do código.
 *
 * Estas contas são administrativas de verdade: `rh@01tecnologia.demo` é admin
 * master do mesmo sistema que roda em produção. Com o repositório público,
 * senha escrita aqui é senha entregue a qualquer pessoa que abra o GitHub.
 *
 * Ficam em `.env.local` (ignorado pelo git) e nas variáveis da Vercel.
 */
function senhaObrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error(
      `Falta ${nome} no .env.local. As senhas do seed não moram mais no código — ` +
        `veja .env.example para a lista completa.`,
    );
  }
  return valor;
}

const SENHA_DEMO = {
  admin: senhaObrigatoria("SEED_SENHA_ADMIN"),
  gestor: senhaObrigatoria("SEED_SENHA_GESTOR"),
  user: senhaObrigatoria("SEED_SENHA_USER"),
};

/**
 * Data de referência do histórico de férias.
 *
 * As situações que a tela de vencimento deve exibir (vencida, crítica, atenção)
 * dependem de onde HOJE cai em relação aos períodos concessivos. Rodando o seed
 * meses depois, as pessoas escorregam para o vermelho — é o comportamento
 * correto do cálculo, mas o roteiro da demonstração deixa de bater. Se isso
 * acontecer, ajuste as contagens de `historico()` em vez de mexer no cálculo.
 */
const HOJE = new Date().toISOString().slice(0, 10);

async function main() {
  console.log("Limpando tabelas…");
  // Ordem importa: TODO filho antes do pai. Qualquer tabela que referencie
  // `users` precisa entrar aqui — inclusive as que guardam só o autor da ação,
  // como `notification_settings.updated_by` e `broadcasts.created_by`.
  await db.delete(formResponses);
  await db.delete(forms);
  await db.delete(broadcastDeliveries);
  await db.delete(broadcasts);
  await db.delete(institutionalEvents);
  await db.delete(notificationSettings);
  await db.delete(notifications);
  await db.delete(passwordResetCodes);
  await db.delete(vacationRequests);
  await db.delete(users);

  const [hashAdmin, hashGestor, hashUser] = await Promise.all([
    bcrypt.hash(SENHA_DEMO.admin, 12),
    bcrypt.hash(SENHA_DEMO.gestor, 12),
    bcrypt.hash(SENHA_DEMO.user, 12),
  ]);

  console.log("Inserindo RH (admin master)…");
  const [rh] = await db
    .insert(users)
    .values({
      name: "Helena Braga Mendonça",
      email: "rh@01tecnologia.demo",
      passwordHash: hashAdmin,
      role: "admin",
      sector: "Recursos Humanos",
      position: "Analista de RH Sênior",
      admissionDate: "2019-03-11",
      employmentType: "clt",
      phone: "(41) 99000-0001",
      discordHandle: "helena.rh",
      birthDate: "1988-07-22",
      cpf: cpfFicticio("529982247"),
      rg: "10.234.567-8",
      zipCode: "80010-010",
      addressStreet: "Rua Marechal Deodoro",
      addressNumber: "100",
      neighborhood: "Centro",
      city: "Curitiba",
      state: "PR",
      isCuritibaMetro: true,
      educationLevel: "Superior completo",
      courseName: "Psicologia",
      institution: "Universidade Fictícia do Paraná",
      motherName: "Marta Braga",
      fatherName: "Aldo Mendonça",
      birthplace: "Curitiba/PR",
      gender: "Feminino",
    })
    .returning({ id: users.id });

  console.log("Inserindo gestores…");
  const gestores = await db
    .insert(users)
    .values([
      {
        name: "Rodrigo Vasques Tavares",
        email: "rodrigo.gestor@01tecnologia.demo",
        passwordHash: hashGestor,
        role: "gestor",
        sector: "Tecnologia",
        position: "Coordenador de Engenharia",
        admissionDate: "2020-01-20",
        employmentType: "clt",
        phone: "(41) 99000-0002",
        discordHandle: "rodrigo.tec",
        birthDate: "1985-11-03",
        cpf: cpfFicticio("168995350"),
        rg: "12.345.678-9",
        zipCode: "83324-000",
        addressStreet: "Rua das Araucárias",
        addressNumber: "420",
        neighborhood: "Centro",
        city: "Piraquara",
        state: "PR",
        isCuritibaMetro: true,
        educationLevel: "Superior completo",
        courseName: "Ciência da Computação",
        institution: "Instituto Fictício de Tecnologia",
        motherName: "Sônia Vasques",
        fatherName: "Elias Tavares",
        birthplace: "Ponta Grossa/PR",
        gender: "Masculino",
      },
      {
        name: "Patrícia Nogueira Alencar",
        email: "patricia.gestora@01tecnologia.demo",
        passwordHash: hashGestor,
        role: "gestor",
        sector: "Operações",
        position: "Gerente de Operações",
        admissionDate: "2018-06-04",
        employmentType: "clt",
        phone: "(41) 99000-0003",
        discordHandle: "patricia.ops",
        birthDate: "1982-02-14",
        cpf: cpfFicticio("264417900"),
        rg: "9.876.543-2",
        zipCode: "89010-000",
        addressStreet: "Rua Inventada",
        addressNumber: "77",
        neighborhood: "Centro",
        city: "Blumenau",
        state: "SC",
        isCuritibaMetro: false,
        educationLevel: "Pós-graduação",
        courseName: "Administração",
        institution: "Faculdade Fictícia de Gestão",
        motherName: "Ivone Nogueira",
        fatherName: "Carlos Alencar",
        birthplace: "Joinville/SC",
        gender: "Feminino",
      },
    ])
    .returning({ id: users.id, sector: users.sector });

  const gestorTec = gestores.find((g) => g.sector === "Tecnologia")!;
  const gestorOps = gestores.find((g) => g.sector === "Operações")!;

  console.log("Inserindo colaboradores…");
  const colaboradores = await db
    .insert(users)
    .values([
      {
        name: "Bruno Sampaio Rocha",
        email: "bruno.rocha@01tecnologia.demo",
        passwordHash: hashUser,
        role: "user",
        sector: "Tecnologia",
        position: "Desenvolvedor Pleno",
        managerId: gestorTec.id,
        admissionDate: "2022-08-15",
        employmentType: "clt",
        phone: "(41) 99000-0004",
        discordHandle: "bruno.dev",
        birthDate: "1995-04-09",
        cpf: cpfFicticio("398702180"),
        rg: "13.579.246-0",
        zipCode: "83005-000",
        addressStreet: "Avenida Imaginária",
        addressNumber: "1500",
        neighborhood: "Afonso Pena",
        city: "São José dos Pinhais",
        state: "PR",
        isCuritibaMetro: true,
        educationLevel: "Superior completo",
        courseName: "Sistemas de Informação",
        institution: "Instituto Fictício de Tecnologia",
        motherName: "Regina Sampaio",
        fatherName: "Osvaldo Rocha",
        birthplace: "Curitiba/PR",
        gender: "Masculino",
      },
      {
        name: "Camila Ferraz Duarte",
        email: "camila.duarte@01tecnologia.demo",
        passwordHash: hashUser,
        role: "user",
        sector: "Tecnologia",
        position: "Analista de QA",
        managerId: gestorTec.id,
        admissionDate: "2023-02-06",
        employmentType: "clt",
        phone: "(41) 99000-0005",
        discordHandle: "camila.qa",
        birthDate: "1997-09-30",
        cpf: cpfFicticio("471263580"),
        rg: "14.680.135-7",
        zipCode: "81530-000",
        addressStreet: "Rua Fictícia do Bosque",
        addressNumber: "233",
        addressComplement: "Apto 302",
        neighborhood: "Jardim das Américas",
        city: "Curitiba",
        state: "PR",
        isCuritibaMetro: true,
        educationLevel: "Superior completo",
        courseName: "Engenharia de Software",
        institution: "Universidade Fictícia do Paraná",
        motherName: "Lúcia Ferraz",
        fatherName: "Jonas Duarte",
        birthplace: "Maringá/PR",
        gender: "Feminino",
      },
      {
        name: "Tiago Moreira Lins",
        email: "tiago.lins@01tecnologia.demo",
        passwordHash: hashUser,
        role: "user",
        sector: "Operações",
        position: "Analista de Suporte",
        managerId: gestorOps.id,
        // Outubro (e não novembro) para o período concessivo dele cair na faixa
        // de "atenção" da tela de vencimento — o caso intermediário do painel.
        admissionDate: "2021-10-08",
        employmentType: "clt",
        phone: "(41) 99000-0006",
        discordHandle: "tiago.ops",
        birthDate: "1993-12-17",
        cpf: cpfFicticio("612845390"),
        rg: "11.223.344-5",
        zipCode: "83601-000",
        addressStreet: "Rua Hipotética",
        addressNumber: "58",
        neighborhood: "Centro",
        city: "Campo Largo",
        state: "PR",
        isCuritibaMetro: true,
        educationLevel: "Superior incompleto",
        courseName: "Redes de Computadores",
        institution: "Faculdade Fictícia de Gestão",
        motherName: "Vera Moreira",
        fatherName: "Paulo Lins",
        birthplace: "Curitiba/PR",
        gender: "Masculino",
      },
      {
        name: "Larissa Antunes Peixoto",
        email: "larissa.peixoto@01tecnologia.demo",
        passwordHash: hashUser,
        role: "user",
        sector: "Operações",
        position: "Assistente Administrativo",
        managerId: gestorOps.id,
        admissionDate: "2024-05-13",
        employmentType: "clt",
        phone: "(41) 99000-0007",
        discordHandle: "larissa.adm",
        birthDate: "2000-06-25",
        cpf: cpfFicticio("735196420"),
        rg: "15.975.310-4",
        zipCode: "83323-000",
        addressStreet: "Travessa Inexistente",
        addressNumber: "9",
        neighborhood: "Vila Fictícia",
        city: "Pinhais",
        state: "PR",
        isCuritibaMetro: true,
        educationLevel: "Ensino médio completo",
        motherName: "Eliane Antunes",
        fatherName: "Márcio Peixoto",
        birthplace: "Curitiba/PR",
        gender: "Feminino",
      },
    ])
    .returning({ id: users.id, email: users.email, admissionDate: users.admissionDate });

  console.log("Gerando histórico de férias…");
  /**
   * Sem histórico, a tela de vencimento acusa TODO MUNDO como vencido — o que é
   * matematicamente correto (ninguém nunca tirou férias) e completamente inútil
   * de olhar: sete linhas vermelhas não mostram o que o painel faz.
   *
   * Aqui cada pessoa recebe férias passadas suficientes para cair numa situação
   * escolhida. O resultado é o espectro que a tela existe para mostrar:
   * uma pessoa vencida, uma crítica, uma em atenção e o resto em dia.
   *
   * `periodos` = quantos períodos aquisitivos fechados já foram usufruídos,
   * do mais antigo para o mais novo (é assim que a lei consome o saldo).
   */
  async function historico(userId: string, admissao: string, periodos: number) {
    const fechados = closedAcquisitivePeriods(admissao, HOJE);
    const linhas = fechados.slice(0, periodos).map((p) => {
      // Gozadas ~3 meses depois de o período fechar: dentro da janela de
      // concessão, como aconteceria de verdade.
      const inicio = addDays(p.end, 90);
      return {
        userId,
        startDate: inicio,
        endDate: addDays(inicio, MAX_DAYS_PER_PERIOD - 1),
        days: MAX_DAYS_PER_PERIOD,
        status: "approved" as const,
        rhApproval: "approved" as const,
        managerApproval: "approved" as const,
        // Sem `paymentDueDate`: férias antigas não devem reaparecer na tela de
        // controle operacional, que é a fila de trabalho do mês.
      };
    });
    if (linhas.length > 0) await db.insert(vacationRequests).values(linhas);
    return linhas.length;
  }

  const colab = (email: string) => {
    const achado = colaboradores.find((c) => c.email.startsWith(`${email}.`));
    if (!achado) throw new Error(`Colaborador "${email}" não encontrado no seed.`);
    return achado;
  };
  const bruno = colab("bruno");
  const camila = colab("camila");
  const tiago = colab("tiago");
  const larissa = colab("larissa");

  // Quantos períodos cada um já usufruiu, e a situação que isso produz em HOJE.
  await historico(gestorOps.id, "2018-06-04", 7); // Patrícia — em dia
  await historico(rh.id, "2019-03-11", 6); // Helena — em dia
  await historico(gestorTec.id, "2020-01-20", 5); // Rodrigo — em dia
  await historico(camila.id, camila.admissionDate!, 3); // quitada
  await historico(tiago.id, tiago.admissionDate!, 3); // ATENÇÃO: vence 07/10/2026
  await historico(bruno.id, bruno.admissionDate!, 2); // CRÍTICO: vence 14/08/2026
  // Larissa fica sem nada de propósito: o período dela venceu em 12/05/2026 e
  // ninguém viu. É exatamente o caso que justifica o painel existir.
  void larissa;

  console.log("Gerando a fila do controle operacional…");
  /**
   * Férias já aprovadas e à frente, para a tela de controle não abrir vazia.
   * Cada linha mostra um estágio diferente do fluxo: pendente de tudo,
   * pendente de pagamento, e concluída.
   */
  await db.insert(vacationRequests).values([
    {
      // Tudo pendente: o RH ainda precisa colher recibo e pagar.
      userId: gestorTec.id,
      startDate: "2026-09-14",
      endDate: "2026-10-03",
      days: 20,
      abonoPecuniario: true,
      abonoDays: 10,
      advance13th: true,
      status: "approved",
      rhApproval: "approved",
      managerApproval: "approved",
      paymentDueDate: "2026-09-10", // 2 dias úteis antes (art. 145)
    },
    {
      // Recibo assinado, pagamento em aberto.
      userId: camila.id,
      startDate: "2026-08-24",
      endDate: "2026-09-06",
      days: 14,
      status: "approved",
      rhApproval: "approved",
      managerApproval: "approved",
      paymentDueDate: "2026-08-20",
      receiptSignedAt: new Date(),
      receiptRegisteredBy: rh.id,
    },
    {
      // Ciclo completo, já repassada à Senior.
      userId: gestorOps.id,
      startDate: "2026-08-10",
      endDate: "2026-08-24",
      days: 15,
      status: "approved",
      rhApproval: "approved",
      managerApproval: "approved",
      paymentDueDate: "2026-08-06",
      receiptSignedAt: new Date(),
      receiptRegisteredBy: rh.id,
      paidAt: new Date(),
      paidBy: rh.id,
      reportedToSeniorAt: new Date(),
    },
  ]);

  console.log("Configurando a central de comunicações…");
  /**
   * Padrão da demonstração: WhatsApp LIGADO em tudo.
   *
   * Decisão de produto — nesta entrega o WhatsApp faz o papel do e-mail, que
   * fica para uma versão futura. Discord e e-mail ficam desligados porque ainda
   * não entregam (DM exige bot; e-mail não está implementado), e ligá-los daria
   * a falsa impressão de que a mensagem saiu.
   */
  const tipos = [
    "password_reset",
    "vacation_request",
    "vacation_decision",
    "vacation_expiring",
    "vacation_receipt",
    "vacation_payment",
    "form_new",
    "form_reminder",
  ] as const;

  await db.insert(notificationSettings).values(
    tipos.flatMap((tipo) => [
      { type: tipo, channel: "whatsapp" as const, enabled: true, updatedBy: rh.id },
      { type: tipo, channel: "discord" as const, enabled: false, updatedBy: rh.id },
      { type: tipo, channel: "email" as const, enabled: false, updatedBy: rh.id },
    ]),
  );
  console.log(`✔ ${tipos.length} tipos × 3 canais configurados (WhatsApp ligado).`);

  // Auto-verificação: o formulário de cadastro valida o dígito verificador do
  // CPF, então um seed com CPF mal formado deixa o próprio registro impossível
  // de editar. Falhar aqui, alto e claro, é melhor que descobrir na tela.
  const inseridos = await db
    .select({ name: users.name, cpf: users.cpf })
    .from(users);

  const cpfsRuins = inseridos.filter((u) => u.cpf && !isValidCpf(u.cpf));
  if (cpfsRuins.length > 0) {
    throw new Error(
      `Seed gerou CPF inválido para: ${cpfsRuins.map((u) => u.name).join(", ")}`,
    );
  }
  console.log(`✔ ${inseridos.length} CPFs conferidos (dígito verificador ok).`);

  console.log(
    `\n✔ Seed concluído: 1 RH, ${gestores.length} gestores, ${colaboradores.length} colaboradores.\n`,
  );
  console.log("Usuários de demonstração (senhas fictícias):");
  console.table([
    { papel: "RH / admin master", email: "rh@01tecnologia.demo", senha: SENHA_DEMO.admin },
    { papel: "Gestor (Tecnologia)", email: "rodrigo.gestor@01tecnologia.demo", senha: SENHA_DEMO.gestor },
    { papel: "Gestor (Operações)", email: "patricia.gestora@01tecnologia.demo", senha: SENHA_DEMO.gestor },
    { papel: "Colaborador", email: "bruno.rocha@01tecnologia.demo", senha: SENHA_DEMO.user },
    { papel: "Colaborador", email: "camila.duarte@01tecnologia.demo", senha: SENHA_DEMO.user },
    { papel: "Colaborador", email: "tiago.lins@01tecnologia.demo", senha: SENHA_DEMO.user },
    { papel: "Colaborador", email: "larissa.peixoto@01tecnologia.demo", senha: SENHA_DEMO.user },
  ]);
  console.log(
    "\nOs telefones são fictícios. Para testar o WhatsApp/Zaia de verdade,\n" +
      "troque o `phone` de um usuário por um número real pela tela de Colaboradores.\n",
  );

  void rh;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
