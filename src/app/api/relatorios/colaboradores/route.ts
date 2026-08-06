import { asc } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { HttpError, requireRoleApi } from "@/lib/dal";
import { formatBR } from "@/lib/clt";
import { csvCell, formatCep, formatCpf, formatPhone } from "@/lib/format";

/**
 * Cadastro completo de colaboradores em CSV.
 *
 * SÓ RH. Sai o cadastro inteiro, incluindo CPF, RG, endereço e filiação — é o
 * arquivo mais sensível que o sistema produz. Por isso: download autenticado,
 * `no-store`, e nada em query string. Quem baixar fica responsável pelo arquivo.
 *
 * A senha nunca entra, nem o hash: não existe uso legítimo de exportar isso, e
 * um hash em planilha circulando é material para ataque offline.
 *
 * `?ativos=1` traz só quem está na ativa, que é o uso comum. Sem o parâmetro
 * vem todo mundo, inclusive desligados — necessário para conferência com a
 * contabilidade.
 */

const ROTULO_TIPO: Record<string, string> = {
  clt: "CLT",
  pj: "PJ",
  estagio: "Estagio",
  aprendiz: "Aprendiz",
  socio: "Socio",
};

const ROTULO_SITUACAO: Record<string, string> = {
  ativo: "Ativo",
  afastado: "Afastado",
  ferias: "De ferias",
  desligado: "Desligado",
};

const ROTULO_PAPEL: Record<string, string> = {
  admin: "RH (admin master)",
  gestor: "Gestor",
  user: "Colaborador",
};

export async function GET(request: Request) {
  try {
    await requireRoleApi("admin");

    const url = new URL(request.url);
    const somenteAtivos = url.searchParams.get("ativos") === "1";

    const linhas = await db
      .select()
      .from(users)
      .orderBy(asc(users.name));

    // Resolve o nome do gestor em memória: são dezenas de pessoas, não vale
    // um join que complicaria a leitura por um ganho que ninguém percebe.
    const nomePorId = new Map(linhas.map((u) => [u.id, u.name]));

    const filtradas = somenteAtivos
      ? linhas.filter((u) => u.isActive && u.employmentStatus !== "desligado")
      : linhas;

    const cabecalho = [
      "Nome",
      "E-mail corporativo",
      "E-mail pessoal",
      "Papel",
      "Situacao",
      "Ativo",
      "Setor",
      "Cargo",
      "Gestor",
      "Admissao",
      "Tipo de contrato",
      "Telefone",
      "Discord",
      "Nascimento",
      "Genero",
      "CPF",
      "RG",
      "CEP",
      "Logradouro",
      "Numero",
      "Complemento",
      "Bairro",
      "Cidade",
      "UF",
      "Regiao metropolitana de Curitiba",
      "Nome da mae",
      "Nome do pai",
      "Naturalidade",
      "Escolaridade",
      "Curso",
      "Instituicao",
      "Cadastrado em",
    ];

    const registros = filtradas.map((u) =>
      [
        u.name,
        u.email,
        u.personalEmail ?? "",
        ROTULO_PAPEL[u.role] ?? u.role,
        ROTULO_SITUACAO[u.employmentStatus] ?? u.employmentStatus,
        u.isActive ? "Sim" : "Nao",
        u.sector ?? "",
        u.position ?? "",
        u.managerId ? (nomePorId.get(u.managerId) ?? "") : "",
        u.admissionDate ? formatBR(u.admissionDate) : "",
        u.employmentType ? (ROTULO_TIPO[u.employmentType] ?? u.employmentType) : "",
        u.phone ? formatPhone(u.phone) : "",
        u.discordHandle ?? "",
        u.birthDate ? formatBR(u.birthDate) : "",
        u.gender ?? "",
        u.cpf ? formatCpf(u.cpf) : "",
        u.rg ?? "",
        u.zipCode ? formatCep(u.zipCode) : "",
        u.addressStreet ?? "",
        u.addressNumber ?? "",
        u.addressComplement ?? "",
        u.neighborhood ?? "",
        u.city ?? "",
        u.state ?? "",
        u.isCuritibaMetro ? "Sim" : "Nao",
        u.motherName ?? "",
        u.fatherName ?? "",
        u.birthplace ?? "",
        u.educationLevel ?? "",
        u.courseName ?? "",
        u.institution ?? "",
        u.createdAt ? u.createdAt.toLocaleDateString("pt-BR") : "",
      ]
        // Aspas em tudo e aspa dobrada por dentro: endereço com ponto e
        // vírgula ou observação com aspas quebraria as colunas.
        .map(csvCell)
        .join(";"),
    );

    // Ponto e vírgula e BOM: é assim que o Excel em português abre o arquivo
    // com as colunas separadas e os acentos corretos, sem passo manual.
    const csv = "﻿" + [cabecalho.join(";"), ...registros].join("\r\n");
    const hoje = new Date().toISOString().slice(0, 10);

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="colaboradores-${hoje}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return new Response(error.message, { status: error.status });
    }
    console.error("[relatorio-colaboradores]", error);
    return new Response("Erro ao gerar o relatório.", { status: 500 });
  }
}
