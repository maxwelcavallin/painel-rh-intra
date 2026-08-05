import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { users, vacationRequests } from "@/db/schema";
import { COMPANY_NOTICE_DAYS, addDays, formatBR } from "@/lib/clt";
import { listVacationStatus } from "@/server/vacation-deadlines";

import { askForJson, parseJsonLoose } from "./ai-client";

/**
 * Parecer de risco e planejamento de férias — do quadro inteiro, não de uma
 * pessoa por vez.
 *
 * O agente de solicitação responde "pode ou não pode" sobre UMA data. A
 * pergunta que falta é de carteira: onde está o passivo, quem precisa entrar
 * na fila primeiro, e que meses já estão sobrecarregados. Um parecer por
 * pessoa respondia a pergunta errada — o RH não decide colaborador a
 * colaborador, decide a ordem de ataque.
 *
 * Escopo pelo papel: RH vê a empresa, gestor vê a própria equipe. É o mesmo
 * recorte da tela de vencimento, para os dois nunca discordarem.
 *
 * Como no agente de férias, os NÚMEROS saem daqui em código. O modelo recebe
 * fatos prontos e escreve a leitura — não recalcula prazo nem saldo.
 */

export type Acao = {
  /** O que fazer, em uma frase imperativa. */
  oQue: string;
  /** Quem é afetado, quando a ação for sobre pessoas específicas. */
  quem: string[];
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

type PessoaEmRisco = {
  nome: string;
  setor: string | null;
  gestor: string | null;
  situacao: string;
  prazo: string;
  diasAteOPrazo: number;
  saldoEmAberto: number;
  jaMarcou: boolean;
  /** Última data em que ainda dá para solicitar cumprindo a antecedência. */
  ultimaDataParaSolicitar: string | null;
};

export type FatosGerais = {
  escopo: string;
  totalPessoas: number;
  vencidas: number;
  criticas: number;
  atencao: number;
  emDia: number;
  /** Soma dos dias em aberto de quem está vencido ou crítico. */
  diasEmRiscoDeDobra: number;
  pessoas: PessoaEmRisco[];
  /** Férias aprovadas à frente, agrupadas por mês — mostra concentração. */
  concentracaoPorMes: { mes: string; pessoas: string[] }[];
  pendenciasOperacionais: string[];
};

const SYSTEM_PROMPT = `Você é analista sênior de RH da 01 Tecnologia e escreve o parecer
de risco da carteira de férias para o time de RH e para gestores.

Você recebe FATOS já apurados de forma determinística pelo sistema.

REGRAS INEGOCIÁVEIS:
1. Nunca recalcule datas, dias, saldo ou prazos. Os números do JSON são a verdade.
2. Não invente informação que não esteja nos fatos.
3. Toda ação recomendada precisa ser concreta e verificável, e dizer QUEM ela
   envolve. "Acompanhar de perto" não é ação; "combinar as datas dos 30 dias de
   Larissa até 02/04/2026" é.
4. Priorize. O parecer serve para decidir a ORDEM DE ATAQUE, não para listar
   tudo que existe. Comece pelo que custa dinheiro mais cedo.
5. O risco central é o art. 137 da CLT: passar do período concessivo obriga a
   empresa a pagar as férias em dobro.
6. Concentração de férias no mesmo mês é risco de operação, não risco legal —
   trate como tal.
7. Escreva para quem decide, não para quem audita.
8. NUNCA comente sobre os dados que recebeu. Frases como "os fatos não trazem
   detalhe individual" ou "seria preciso mais informação" falam do sistema, não
   da carteira, e quem lê não tem o que fazer com isso.
9. Carteira sem problema é resultado legítimo. Se não houver risco, devolva
   "riscos" e "acoes" como listas VAZIAS e diga no resumo que está tudo em dia.
   Não invente risco genérico ("pode haver concentração no futuro") só para
   preencher — parecer que alarma sem motivo deixa de ser levado a sério.

CLASSIFICAÇÃO DO RISCO GERAL:
- "alto": existe prazo já vencido, ou vencendo em menos de 30 dias sem férias
  marcadas que resolvam.
- "medio": prazos se aproximando, ou concentração relevante num mesmo mês.
- "baixo": carteira sob controle.

FORMATO — responda SOMENTE com um objeto JSON, sem markdown e sem cercas:
{
  "risco": "alto" | "medio" | "baixo",
  "resumo": "2 a 4 frases em português do Brasil, com os números que importam",
  "riscos": ["cada item uma frase completa"],
  "acoes": [{ "oQue": "frase imperativa", "quem": ["Nome"], "ateQuando": "DD/MM/AAAA ou null" }]
}
Use no máximo 5 riscos e 5 ações, em ordem de prioridade.`;

const ROTULO_SITUACAO = {
  expired: "vencida",
  critical: "crítica",
  warning: "atenção",
  ok: "em dia",
} as const;

/** Apura o quadro completo dentro do escopo de quem pediu. */
export async function reunirFatosGerais(
  solicitante: { id: string; role: string },
  todayISO: string = new Date().toISOString().slice(0, 10),
): Promise<FatosGerais> {
  const ehRH = solicitante.role === "admin";
  const todos = await listVacationStatus(todayISO);
  const status = ehRH
    ? todos
    : todos.filter((s) => s.managerId === solicitante.id);

  const pessoas: PessoaEmRisco[] = status
    // Quem está em dia não ajuda a decidir a ordem de ataque e só gasta
    // contexto do modelo. A contagem de "em dia" continua no resumo.
    .filter((s) => s.severity !== "ok")
    .map((s) => ({
      nome: s.name,
      setor: s.sector,
      gestor: s.managerName,
      situacao: ROTULO_SITUACAO[s.severity],
      prazo: formatBR(s.deadline.concessiveEnd),
      diasAteOPrazo: s.deadline.daysUntilDeadline,
      saldoEmAberto: s.daysRemaining,
      jaMarcou: s.hasScheduled,
      ultimaDataParaSolicitar: s.deadline.settled
        ? null
        : formatBR(addDays(s.deadline.concessiveEnd, -COMPANY_NOTICE_DAYS)),
    }));

  // Concentração: quantas pessoas do escopo saem em cada mês à frente.
  const idsDoEscopo = new Set(status.map((s) => s.userId));
  const aprovadas = await db
    .select({
      nome: users.name,
      userId: vacationRequests.userId,
      inicio: vacationRequests.startDate,
      fim: vacationRequests.endDate,
      paymentDueDate: vacationRequests.paymentDueDate,
      paidAt: vacationRequests.paidAt,
      receiptSignedAt: vacationRequests.receiptSignedAt,
    })
    .from(vacationRequests)
    .innerJoin(users, eq(users.id, vacationRequests.userId))
    .where(
      and(
        eq(vacationRequests.status, "approved"),
        isNull(vacationRequests.cancelledAt),
      ),
    );

  const doEscopo = aprovadas.filter(
    (a) => idsDoEscopo.has(a.userId) && a.fim >= todayISO,
  );

  const porMes = new Map<string, string[]>();
  for (const a of doEscopo) {
    const mes = a.inicio.slice(0, 7);
    porMes.set(mes, [...(porMes.get(mes) ?? []), a.nome]);
  }

  const pendenciasOperacionais: string[] = [];
  if (ehRH) {
    for (const a of doEscopo) {
      if (a.inicio < todayISO) continue;
      if (a.paymentDueDate && !a.paidAt) {
        pendenciasOperacionais.push(
          `${a.nome}: férias em ${formatBR(a.inicio)} com pagamento em aberto, limite ${formatBR(a.paymentDueDate)}.`,
        );
      }
      if (!a.receiptSignedAt) {
        pendenciasOperacionais.push(
          `${a.nome}: recibo das férias de ${formatBR(a.inicio)} ainda sem assinatura.`,
        );
      }
    }
  }

  return {
    escopo: ehRH ? "Toda a empresa" : "Equipe direta do gestor",
    totalPessoas: status.length,
    vencidas: status.filter((s) => s.severity === "expired").length,
    criticas: status.filter((s) => s.severity === "critical").length,
    atencao: status.filter((s) => s.severity === "warning").length,
    emDia: status.filter((s) => s.severity === "ok").length,
    diasEmRiscoDeDobra: status
      .filter((s) => s.severity === "expired" || s.severity === "critical")
      .reduce((soma, s) => soma + s.daysRemaining, 0),
    pessoas,
    concentracaoPorMes: [...porMes.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, nomes]) => ({
        mes: `${mes.slice(5)}/${mes.slice(0, 4)}`,
        pessoas: nomes,
      })),
    pendenciasOperacionais,
  };
}

/**
 * Parecer sem modelo — o mesmo papel do `deterministicVerdict` do agente.
 *
 * Não é texto de desculpa: é o parecer que os próprios números sustentam. Uma
 * tela de RH não pode ficar em branco porque um serviço externo caiu.
 */
function parecerDeterministico(f: FatosGerais): Parecer {
  const riscos: string[] = [];
  const acoes: Acao[] = [];
  let risco: Parecer["risco"] = "baixo";

  const vencidas = f.pessoas.filter((p) => p.situacao === "vencida");
  const criticas = f.pessoas.filter((p) => p.situacao === "crítica");

  if (vencidas.length > 0) {
    risco = "alto";
    riscos.push(
      `${vencidas.length} pessoa(s) com o período concessivo já vencido, somando ` +
        `${vencidas.reduce((s, p) => s + p.saldoEmAberto, 0)} dia(s) sujeitos a ` +
        `pagamento em dobro (art. 137 da CLT).`,
    );
    acoes.push({
      oQue: "Agendar imediatamente os dias vencidos e apurar com a folha o que já é devido em dobro",
      quem: vencidas.map((p) => p.nome),
      ateQuando: null,
    });
  }

  if (criticas.length > 0) {
    if (risco === "baixo") risco = "alto";
    riscos.push(
      `${criticas.length} pessoa(s) a menos de 30 dias do prazo de concessão.`,
    );
    for (const p of criticas.filter((p) => !p.jaMarcou).slice(0, 3)) {
      acoes.push({
        oQue: `Combinar as datas dos ${p.saldoEmAberto} dia(s) em aberto`,
        quem: [p.nome],
        ateQuando: p.ultimaDataParaSolicitar,
      });
    }
  }

  if (f.atencao > 0 && risco === "baixo") risco = "medio";
  if (f.atencao > 0) {
    riscos.push(`${f.atencao} pessoa(s) com prazo entre 30 e 90 dias.`);
  }

  const cheios = f.concentracaoPorMes.filter((m) => m.pessoas.length >= 3);
  for (const m of cheios) {
    if (risco === "baixo") risco = "medio";
    riscos.push(
      `${m.pessoas.length} pessoas de férias em ${m.mes}: ${m.pessoas.join(", ")}.`,
    );
  }

  if (f.pendenciasOperacionais.length > 0) {
    if (risco === "baixo") risco = "medio";
    riscos.push(
      `${f.pendenciasOperacionais.length} pendência(s) de recibo ou pagamento antes do início das férias.`,
    );
    acoes.push({
      oQue: "Regularizar recibo e pagamento antes do início (art. 145)",
      quem: [],
      ateQuando: null,
    });
  }

  const resumo =
    riscos.length === 0
      ? `${f.escopo}: ${f.totalPessoas} pessoa(s), todas com as férias em dia. Nenhum prazo de concessão correndo.`
      : `${f.escopo}: ${f.totalPessoas} pessoa(s), sendo ${f.vencidas} vencida(s), ` +
        `${f.criticas} crítica(s) e ${f.atencao} em atenção. ` +
        `${f.diasEmRiscoDeDobra} dia(s) correm risco de pagamento em dobro.`;

  return { risco, resumo, riscos: riscos.slice(0, 5), acoes: acoes.slice(0, 5), fromModel: false };
}

export async function gerarParecerGeral(
  solicitante: { id: string; role: string },
  todayISO: string = new Date().toISOString().slice(0, 10),
): Promise<{ fatos: FatosGerais; parecer: Parecer }> {
  const fatos = await reunirFatosGerais(solicitante, todayISO);

  const resposta = await askForJson({
    system: SYSTEM_PROMPT,
    user: JSON.stringify({ hoje: todayISO, ...fatos }, null, 2),
    maxTokens: 2000,
  });

  if (!resposta) return { fatos, parecer: parecerDeterministico(fatos) };

  const bruto = parseJsonLoose<{
    risco?: string;
    resumo?: string;
    riscos?: string[];
    acoes?: { oQue?: string; quem?: string[]; ateQuando?: string | null }[];
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
      riscos: (bruto.riscos ?? []).filter((r) => typeof r === "string").slice(0, 5),
      acoes: (bruto.acoes ?? [])
        .filter((a) => a && typeof a.oQue === "string")
        .slice(0, 5)
        .map((a) => ({
          oQue: a.oQue as string,
          quem: Array.isArray(a.quem) ? a.quem.filter((q) => typeof q === "string") : [],
          ateQuando: a.ateQuando ?? null,
        })),
      fromModel: true,
    },
  };
}
