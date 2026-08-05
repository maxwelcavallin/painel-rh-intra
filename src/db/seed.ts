import { config } from "dotenv";

config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import bcrypt from "bcryptjs";

import { isValidCpf } from "../lib/format";

import * as schema from "./schema";
import {
  notificationSettings,
  notifications,
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
 * Completa uma base de 9 dígitos com os dois verificadores corretos.
 *
 * Escrever CPF fictício à mão não funciona: o formulário de cadastro valida o
 * dígito verificador, então um CPF "de mentira" mal formado trava a edição do
 * próprio seed. Calculando aqui, o dado fictício continua fictício mas passa
 * na mesma validação que um real.
 */
function cpfFicticio(base9: string): string {
  const digits = base9.split("").map(Number);

  const checkDigit = (slice: number[]) => {
    const weightStart = slice.length + 1;
    const sum = slice.reduce((acc, d, i) => acc + d * (weightStart - i), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  const d1 = checkDigit(digits);
  const d2 = checkDigit([...digits, d1]);
  const full = `${base9}${d1}${d2}`;

  return `${full.slice(0, 3)}.${full.slice(3, 6)}.${full.slice(6, 9)}-${full.slice(9)}`;
}

const SENHA_DEMO = {
  admin: "Rh@2026demo",
  gestor: "Gestor@2026",
  user: "Colab@2026",
};

async function main() {
  console.log("Limpando tabelas…");
  // Ordem importa: filhos antes dos pais (FKs com cascade, mas explícito é melhor).
  await db.delete(notifications);
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
        admissionDate: "2021-11-22",
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
    .returning({ id: users.id, name: users.name });

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

  await db.delete(notificationSettings);
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
