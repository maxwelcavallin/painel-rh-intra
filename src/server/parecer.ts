import "server-only";

import { and, eq, isNull, ne } from "drizzle-orm";

import { db } from "@/db";
import { users, vacationRequests } from "@/db/schema";
import {
  COMPANY_NOTICE_DAYS,
  addDays,
  formatBR,
  vacationDeadlineFor,
} from "@/lib/clt";

import { askForJson, parseJsonLoose } from "./ai-client";

/**
 * Parecer de risco e planejamento para o RH e o gestor.
 *
 * Complementa o agente de solicitação, que responde "pode ou não pode" sobre
 * UMA data. Aqui a pergunta é outra: olhando o histórico, o saldo, o prazo de
 * concessão e o que a equipe já tem marcado, o que corre risco de dar errado e
 * o que precisa ser combinado ANTES de virar problema.
 *
 * É sob demanda de propósito. Gerar em toda abertura de tela gastaria chamada
 * de modelo em linha que ninguém vai ler, e o RH quer o parecer no momento em
 * que está de fato pensando naquela pessoa.
 *
 * Como no agente de férias, os NÚMEROS são apurados aqui em código. O modelo
 * recebe fatos prontos e escreve a leitura — não recalcula prazo nem saldo.
 */

export type Acao = {
  /** O que fazer, em uma frase imperativa. */
  oQue: string;
  /** Data-limite no formato brasileiro, ou null quando não há prazo duro. */
  ateQuando: string | null;
};

export type Parecer = {
  risco: "alto" | "medio" | "baixo";
  resumo: string;
  riscos: string[];
  acoes: Acao[];
  /** `false` quando o parecer saiu do caminho determinístico, sem modelo. */
  fromModel: boolean;
};

/** Os fatos apurados que alimentam o parecer. Ficam expostos para a tela. */
export type FatosParecer = {
  nome: string;
  setor: string | null;
  cargo: string | null;
  admissao: string;
  gestor: string | null;
  deadline: ReturnType<typeof vacationDeadlineFor>;
  diasUsufruidos: number;
  saldoEmAberto: number;
  /** Última data em que ainda dá para solicitar cumprindo a antecedência. */
  ultimaDataParaSolicitar: string | null;
  historico: {
    inicio: string;
    fim: string;
    dias: number;
    abono: number;
    status: string;
    canceladaEm: string | null;
  }[];
  cancelamentos: number;
  equipeNoPeriodo: { nome: string; inicio: string; fim: string }[];
  pendencias: string[];
};

const SYSTEM_PROMPT = `Você é analista sênior de RH da 01 Tecnologia e escreve pareceres
para o time de RH e para gestores sobre a situação de férias de um colaborador.

Você recebe FATOS já apurados de forma determinística pelo sistema.

REGRAS INEGOCIÁVEIS:
1. Nunca recalcule datas, dias, saldo ou prazos. Os números do JSON são a verdade.
2. Não invente informação que não esteja nos fatos. Se algo não foi informado,
   não especule sobre o motivo.
3. Toda ação recomendada precisa ser concreta e verificável. "Acompanhar de perto"
   não é ação; "combinar as datas dos 16 dias restantes até 05/07/2026" é.
4. O risco central é o art. 137 da CLT: passar do período concessivo obriga a
   empresa a pagar as férias em dobro. Prazo vencido ou perto de vencer com saldo
   em aberto é sempre risco alto.
5. Escreva para quem decide, não para quem audita. Sem juridiquês desnecessário.

CLASSIFICAÇÃO DO RISCO:
- "alto": prazo de concessão vencido, ou vencendo com saldo em aberto e sem
  solicitação marcada que resolva a tempo.
- "medio": prazo se aproximando com folga apertada, concentração relevante da
  equipe no mesmo período, ou padrão de cancelamentos que atrapalha o planejamento.
- "baixo": situação sob controle.

FORMATO — responda SOMENTE com um objeto JSON, sem markdown e sem cercas:
{
  "risco": "alto" | "medio" | "baixo",
  "resumo": "2 a 3 frases em português do Brasil, direto ao ponto",
  "riscos": ["cada item uma frase completa"],
  "acoes": [{ "oQue": "frase imperativa", "ateQuando": "DD/MM/AAAA ou null" }]
}
Use no máximo 4 riscos e 4 ações. Se não houver risco, devolva lista vazia e
diga isso no resumo.`;

/**
 * Apura tudo que o parecer usa. Separado da chamada ao modelo para a tela
 * conseguir mostrar os fatos mesmo quando a IA está fora do ar.
 */
export async function reunirFatos(
  userId: string,
  todayISO: string = new Date().toISOString().slice(0, 10),
): Promise<FatosParecer | null> {
  const [pessoa] = await db
    .select({
      id: users.id,
      name: users.name,
      sector: users.sector,
      position: users.position,
      admissionDate: users.admissionDate,
      managerId: users.managerId,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!pessoa?.admissionDate) return null;

  const [gestor] = pessoa.managerId
    ? await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, pessoa.managerId))
        .limit(1)
    : [];

  const solicitacoes = await db
    .select({
      startDate: vacationRequests.startDate,
      endDate: vacationRequests.endDate,
      days: vacationRequests.days,
      abonoDays: vacationRequests.abonoDays,
      status: vacationRequests.status,
      cancelledAt: vacationRequests.cancelledAt,
      paidAt: vacationRequests.paidAt,
      receiptSignedAt: vacationRequests.receiptSignedAt,
      paymentDueDate: vacationRequests.paymentDueDate,
    })
    .from(vacationRequests)
    .where(eq(vacationRequests.userId, userId))
    .orderBy(vacationRequests.startDate);

  // Só o aprovado e não cancelado consome saldo — igual ao cálculo da tela
  // de vencimento, para os dois números nunca divergirem.
  const diasUsufruidos = solicitacoes
    .filter((r) => r.status === "approved" && !r.cancelledAt)
    .reduce((soma, r) => soma + r.days + r.abonoDays, 0);

  const deadline = vacationDeadlineFor(
    pessoa.admissionDate,
    todayISO,
    diasUsufruidos,
  );

  // Recuar a antecedência a partir do prazo dá a data em que a conversa
  // precisa acontecer — que é o número acionável, não o prazo em si.
  const ultimaDataParaSolicitar = deadline.settled
    ? null
    : addDays(deadline.concessiveEnd, -COMPANY_NOTICE_DAYS);

  const equipe = pessoa.managerId
    ? await db
        .select({
          nome: users.name,
          inicio: vacationRequests.startDate,
          fim: vacationRequests.endDate,
        })
        .from(vacationRequests)
        .innerJoin(users, eq(users.id, vacationRequests.userId))
        .where(
          and(
            eq(users.managerId, pessoa.managerId),
            ne(vacationRequests.userId, userId),
            eq(vacationRequests.status, "approved"),
            isNull(vacationRequests.cancelledAt),
          ),
        )
    : [];

  const pendencias: string[] = [];
  for (const r of solicitacoes) {
    if (r.status !== "approved" || r.cancelledAt) continue;
    if (r.startDate < todayISO) continue;
    if (r.paymentDueDate && !r.paidAt) {
      pendencias.push(
        `Férias de ${formatBR(r.startDate)}: pagamento em aberto, limite ${formatBR(r.paymentDueDate)}.`,
      );
    }
    if (!r.receiptSignedAt) {
      pendencias.push(
        `Férias de ${formatBR(r.startDate)}: recibo ainda sem assinatura registrada.`,
      );
    }
  }

  return {
    nome: pessoa.name,
    setor: pessoa.sector,
    cargo: pessoa.position,
    admissao: pessoa.admissionDate,
    gestor: gestor?.name ?? null,
    deadline,
    diasUsufruidos,
    saldoEmAberto: deadline.daysRemainingInPeriod,
    ultimaDataParaSolicitar,
    historico: solicitacoes.map((r) => ({
      inicio: r.startDate,
      fim: r.endDate,
      dias: r.days,
      abono: r.abonoDays,
      status: r.status,
      canceladaEm: r.cancelledAt ? r.cancelledAt.toISOString().slice(0, 10) : null,
    })),
    cancelamentos: solicitacoes.filter((r) => r.cancelledAt).length,
    equipeNoPeriodo: equipe.filter((t) => t.fim >= todayISO),
    pendencias,
  };
}

/**
 * Parecer sem modelo — o mesmo papel do `deterministicVerdict` do agente.
 *
 * Não é texto de desculpa: é o parecer que os próprios números sustentam. Uma
 * tela de RH não pode ficar em branco porque um serviço externo caiu.
 */
function parecerDeterministico(f: FatosParecer): Parecer {
  const riscos: string[] = [];
  const acoes: Acao[] = [];
  let risco: Parecer["risco"] = "baixo";

  if (f.deadline.expired) {
    risco = "alto";
    riscos.push(
      `O período aquisitivo de ${formatBR(f.deadline.acquisitive.start)} a ` +
        `${formatBR(f.deadline.acquisitive.end)} deveria ter sido concedido até ` +
        `${formatBR(f.deadline.concessiveEnd)} e o prazo passou. Restam ` +
        `${f.saldoEmAberto} dia(s) em aberto, sujeitos a pagamento em dobro (art. 137).`,
    );
    acoes.push({
      oQue: `Agendar imediatamente os ${f.saldoEmAberto} dia(s) em aberto e verificar com a folha o que já é devido em dobro`,
      ateQuando: null,
    });
  } else if (!f.deadline.settled && f.deadline.daysUntilDeadline <= 90) {
    risco = f.deadline.daysUntilDeadline <= 30 ? "alto" : "medio";
    riscos.push(
      `Faltam ${f.deadline.daysUntilDeadline} dia(s) para o prazo de concessão ` +
        `(${formatBR(f.deadline.concessiveEnd)}), com ${f.saldoEmAberto} dia(s) em aberto.`,
    );
    if (f.ultimaDataParaSolicitar) {
      acoes.push({
        oQue: `Combinar as datas dos ${f.saldoEmAberto} dia(s) restantes`,
        ateQuando: formatBR(f.ultimaDataParaSolicitar),
      });
    }
  }

  if (f.cancelamentos >= 2) {
    if (risco === "baixo") risco = "medio";
    riscos.push(
      `${f.cancelamentos} solicitações canceladas no histórico — o planejamento não está se sustentando.`,
    );
    acoes.push({
      oQue: "Conversar sobre o que tem atrapalhado o cumprimento das datas combinadas",
      ateQuando: null,
    });
  }

  if (f.equipeNoPeriodo.length >= 2) {
    if (risco === "baixo") risco = "medio";
    riscos.push(
      `${f.equipeNoPeriodo.length} pessoa(s) da mesma equipe com férias aprovadas à frente: ` +
        f.equipeNoPeriodo
          .map((t) => `${t.nome} (${formatBR(t.inicio)} a ${formatBR(t.fim)})`)
          .join("; ") +
        ".",
    );
  }

  for (const p of f.pendencias) {
    if (risco === "baixo") risco = "medio";
    riscos.push(p);
  }
  if (f.pendencias.length > 0) {
    acoes.push({
      oQue: "Regularizar recibo e pagamento antes do início das férias (art. 145)",
      ateQuando: null,
    });
  }

  const resumo =
    riscos.length === 0
      ? `${f.nome} está com as férias em dia: ${f.diasUsufruidos} dia(s) usufruídos e nenhum prazo de concessão correndo.`
      : `${f.nome} tem ${riscos.length} ponto(s) de atenção. ` +
        (f.deadline.expired
          ? "O prazo de concessão já venceu — é o item mais caro da lista."
          : `Prazo de concessão em ${formatBR(f.deadline.concessiveEnd)}.`);

  return { risco, resumo, riscos, acoes, fromModel: false };
}

export async function gerarParecer(
  userId: string,
  todayISO: string = new Date().toISOString().slice(0, 10),
): Promise<{ fatos: FatosParecer; parecer: Parecer } | null> {
  const fatos = await reunirFatos(userId, todayISO);
  if (!fatos) return null;

  const resposta = await askForJson({
    system: SYSTEM_PROMPT,
    user: JSON.stringify({ hoje: todayISO, ...fatos }, null, 2),
    maxTokens: 1500,
  });

  if (!resposta) return { fatos, parecer: parecerDeterministico(fatos) };

  const bruto = parseJsonLoose<{
    risco?: string;
    resumo?: string;
    riscos?: string[];
    acoes?: { oQue?: string; ateQuando?: string | null }[];
  }>(resposta.text);

  if (!bruto?.resumo) return { fatos, parecer: parecerDeterministico(fatos) };

  // O modelo escreve; a classificação de risco continua ancorada no cálculo.
  // Prazo vencido é risco alto por definição, e não por opinião do modelo.
  const base = parecerDeterministico(fatos);
  const risco =
    base.risco === "alto"
      ? "alto"
      : bruto.risco === "alto" || bruto.risco === "medio" || bruto.risco === "baixo"
        ? bruto.risco
        : base.risco;

  return {
    fatos,
    parecer: {
      risco,
      resumo: bruto.resumo,
      riscos: (bruto.riscos ?? []).filter((r) => typeof r === "string").slice(0, 4),
      acoes: (bruto.acoes ?? [])
        .filter((a) => a && typeof a.oQue === "string")
        .slice(0, 4)
        .map((a) => ({ oQue: a.oQue as string, ateQuando: a.ateQuando ?? null })),
      fromModel: true,
    },
  };
}
