import "server-only";

import { and, eq, isNull, ne } from "drizzle-orm";

import { db } from "@/db";
import { users, vacationRequests } from "@/db/schema";
import { COMPANY_NOTICE_DAYS, addDays, formatBR } from "@/lib/clt";
import { listVacationStatus } from "@/server/vacation-deadlines";

import { askForJson, parseJsonLoose } from "./ai-client";

/**
 * Parecer de risco e planejamento de férias, em dois recortes.
 *
 *   - INDIVIDUAL: o dossiê de uma pessoa — histórico, saldo, prazo, agenda da
 *     equipe e pendências operacionais.
 *   - GERAL: a carteira inteira, COMPILADA a partir dos mesmos dossiês.
 *
 * O geral não é um resumo da tabela da tela. Ele monta o dossiê completo de
 * cada pessoa em risco e pede ao modelo que compile — foi assim que ele deixou
 * de sair genérico. Um parecer de carteira alimentado só por contagens produz
 * conselho de manual; alimentado pelos dossiês, produz ordem de ataque com
 * nome, número e data.
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
  /** Quem é afetado. Vazio quando a ação é da área, não de uma pessoa. */
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

/** Dossiê de uma pessoa — a unidade de análise dos dois pareceres. */
export type FatosPessoa = {
  nome: string;
  setor: string | null;
  cargo: string | null;
  admissao: string;
  gestor: string | null;
  situacao: "vencida" | "crítica" | "atenção" | "em dia";
  periodoPreso: { inicio: string; fim: string };
  prazoDeConcessao: string;
  diasAteOPrazo: number;
  diasUsufruidos: number;
  saldoEmAberto: number;
  /** Última data em que ainda dá para solicitar cumprindo a antecedência. */
  ultimaDataParaSolicitar: string | null;
  jaTemFeriasMarcadas: boolean;
  historico: {
    inicio: string;
    fim: string;
    dias: number;
    abono: number;
    status: string;
    cancelada: boolean;
  }[];
  cancelamentos: number;
  equipeNoMesmoPeriodo: { nome: string; inicio: string; fim: string }[];
  pendencias: string[];
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
  /** Dossiê completo de cada pessoa fora do "em dia". */
  dossies: FatosPessoa[];
  /** Férias aprovadas à frente, agrupadas por mês — mostra concentração. */
  concentracaoPorMes: { mes: string; pessoas: string[] }[];
};

/**
 * Teto de dossiês enviados ao modelo.
 *
 * Não é limite de risco: quem passar do teto continua contado nas estatísticas
 * e no parecer determinístico. É limite de CONTEXTO — mandar cinquenta
 * históricos completos degrada a resposta em vez de melhorá-la.
 */
const MAX_DOSSIES = 12;

const REGRAS_COMUNS = `Você recebe FATOS já apurados de forma determinística pelo sistema.

REGRAS INEGOCIÁVEIS:
1. Nunca recalcule datas, dias, saldo ou prazos. Os números do JSON são a verdade.
2. Não invente informação que não esteja nos fatos.
3. Toda ação recomendada precisa ser concreta e verificável. "Acompanhar de
   perto" não é ação; "combinar as datas dos 16 dias restantes até 05/07/2026" é.
4. O risco central é o art. 137 da CLT: passar do período concessivo obriga a
   empresa a pagar as férias em dobro. Prazo vencido, ou vencendo com saldo em
   aberto e sem férias marcadas, é sempre risco alto.
5. Concentração de férias no mesmo mês é risco de OPERAÇÃO, não risco legal.
6. Cancelamentos repetidos indicam planejamento que não se sustenta — trate
   como sinal, não como falta.
7. NUNCA comente sobre os dados que recebeu. Frases como "seria preciso mais
   informação" falam do sistema, não das pessoas.
8. Situação sem problema é resultado legítimo. Sem risco, devolva "riscos" e
   "acoes" VAZIOS e diga no resumo que está em dia. Não invente risco genérico
   para preencher — parecer que alarma sem motivo deixa de ser levado a sério.
9. Escreva para quem decide, não para quem audita. Sem juridiquês desnecessário.`;

const FORMATO = `FORMATO — responda SOMENTE com um objeto JSON, sem markdown e sem cercas:
{
  "risco": "alto" | "medio" | "baixo",
  "resumo": "2 a 4 frases em português do Brasil, com os números que importam",
  "riscos": ["cada item uma frase completa"],
  "acoes": [{ "oQue": "frase imperativa", "quem": ["Nome"], "ateQuando": "DD/MM/AAAA ou null" }]
}`;

const PROMPT_INDIVIDUAL = `Você é analista sênior de RH da 01 Tecnologia e escreve o
parecer de férias de UMA pessoa, para o RH e para o gestor dela.

${REGRAS_COMUNS}

Aprofunde: use o histórico, os cancelamentos e a agenda da equipe para explicar
COMO a pessoa chegou nesta situação e o que precisa ser combinado.

${FORMATO}
Use no máximo 4 riscos e 4 ações.`;

const PROMPT_GERAL = `Você é analista sênior de RH da 01 Tecnologia e escreve o parecer
de risco da CARTEIRA de férias, para o RH e para gestores.

Você recebe o DOSSIÊ COMPLETO de cada pessoa fora da situação "em dia": o
histórico, os cancelamentos, o prazo, o saldo e a agenda da equipe. Analise
pessoa por pessoa e então COMPILE.

${REGRAS_COMUNS}
10. Priorize. O parecer serve para decidir a ORDEM DE ATAQUE. Comece pelo que
    custa dinheiro mais cedo, e ordene as ações por urgência real, não pela
    ordem em que as pessoas aparecem.
11. Cada risco deve citar a PESSOA e o NÚMERO que o sustenta. "Há casos
    vencidos" não serve; "Larissa acumula 30 dias vencidos desde 12/05/2026,
    sem nada marcado" serve.
12. Se o histórico de alguém explicar o problema — cancelamentos seguidos,
    período nunca usufruído, segundo ciclo aquisitivo fechando por cima do
    primeiro —, diga isso. É o que a tabela da tela não mostra.

${FORMATO}
Use no máximo 6 riscos e 6 ações, em ordem de prioridade.`;

const ROTULO_SITUACAO = {
  expired: "vencida",
  critical: "crítica",
  warning: "atenção",
  ok: "em dia",
} as const;

/* ------------------------------------------------------------------ */
/* Apuração                                                            */
/* ------------------------------------------------------------------ */

type LinhaStatus = Awaited<ReturnType<typeof listVacationStatus>>[number];

/**
 * Monta o dossiê de uma pessoa a partir da linha já calculada pela tela de
 * vencimento, evitando recalcular prazo e saldo por outro caminho.
 */
async function montarDossie(
  s: LinhaStatus,
  todayISO: string,
): Promise<FatosPessoa> {
  const [pessoa] = await db
    .select({ position: users.position })
    .from(users)
    .where(eq(users.id, s.userId))
    .limit(1);

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
    .where(eq(vacationRequests.userId, s.userId))
    .orderBy(vacationRequests.startDate);

  const equipe = s.managerId
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
            eq(users.managerId, s.managerId),
            ne(vacationRequests.userId, s.userId),
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
    nome: s.name,
    setor: s.sector,
    cargo: pessoa?.position ?? null,
    admissao: formatBR(s.admissionDate),
    gestor: s.managerName,
    situacao: ROTULO_SITUACAO[s.severity],
    periodoPreso: {
      inicio: formatBR(s.deadline.acquisitive.start),
      fim: formatBR(s.deadline.acquisitive.end),
    },
    prazoDeConcessao: formatBR(s.deadline.concessiveEnd),
    diasAteOPrazo: s.deadline.daysUntilDeadline,
    diasUsufruidos: s.daysTaken,
    saldoEmAberto: s.daysRemaining,
    // Recuar a antecedência a partir do prazo dá a data em que a conversa
    // precisa acontecer — que é o número acionável, não o prazo em si.
    ultimaDataParaSolicitar: s.deadline.settled
      ? null
      : formatBR(addDays(s.deadline.concessiveEnd, -COMPANY_NOTICE_DAYS)),
    jaTemFeriasMarcadas: s.hasScheduled,
    historico: solicitacoes.map((r) => ({
      inicio: formatBR(r.startDate),
      fim: formatBR(r.endDate),
      dias: r.days,
      abono: r.abonoDays,
      status: r.status,
      cancelada: r.cancelledAt !== null,
    })),
    cancelamentos: solicitacoes.filter((r) => r.cancelledAt).length,
    equipeNoMesmoPeriodo: equipe
      .filter((t) => t.fim >= todayISO)
      .map((t) => ({
        nome: t.nome,
        inicio: formatBR(t.inicio),
        fim: formatBR(t.fim),
      })),
    pendencias,
  };
}

export async function reunirFatosPessoa(
  userId: string,
  todayISO: string = new Date().toISOString().slice(0, 10),
): Promise<FatosPessoa | null> {
  const linha = (await listVacationStatus(todayISO)).find(
    (s) => s.userId === userId,
  );
  if (!linha) return null;
  return montarDossie(linha, todayISO);
}

export async function reunirFatosGerais(
  solicitante: { id: string; role: string },
  todayISO: string = new Date().toISOString().slice(0, 10),
): Promise<FatosGerais> {
  const ehRH = solicitante.role === "admin";
  const todos = await listVacationStatus(todayISO);
  const status = ehRH
    ? todos
    : todos.filter((s) => s.managerId === solicitante.id);

  // Só quem tem algo a resolver ganha dossiê. Quem está em dia continua nas
  // contagens; mandar o histórico dele ao modelo é contexto sem retorno.
  const emRisco = status
    .filter((s) => s.severity !== "ok")
    .sort((a, b) => a.deadline.daysUntilDeadline - b.deadline.daysUntilDeadline)
    .slice(0, MAX_DOSSIES);

  const dossies = await Promise.all(
    emRisco.map((s) => montarDossie(s, todayISO)),
  );

  // Concentração por mês: risco de operação, não legal.
  const idsDoEscopo = new Set(status.map((s) => s.userId));
  const aprovadas = await db
    .select({
      nome: users.name,
      userId: vacationRequests.userId,
      inicio: vacationRequests.startDate,
      fim: vacationRequests.endDate,
    })
    .from(vacationRequests)
    .innerJoin(users, eq(users.id, vacationRequests.userId))
    .where(
      and(
        eq(vacationRequests.status, "approved"),
        isNull(vacationRequests.cancelledAt),
      ),
    );

  const porMes = new Map<string, string[]>();
  for (const a of aprovadas) {
    if (!idsDoEscopo.has(a.userId) || a.fim < todayISO) continue;
    const mes = a.inicio.slice(0, 7);
    porMes.set(mes, [...(porMes.get(mes) ?? []), a.nome]);
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
    dossies,
    concentracaoPorMes: [...porMes.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, nomes]) => ({
        mes: `${mes.slice(5)}/${mes.slice(0, 4)}`,
        pessoas: nomes,
      })),
  };
}

/* ------------------------------------------------------------------ */
/* Caminho determinístico — o parecer que os números sustentam sozinhos */
/* ------------------------------------------------------------------ */

function riscosDoDossie(d: FatosPessoa): { riscos: string[]; acoes: Acao[] } {
  const riscos: string[] = [];
  const acoes: Acao[] = [];

  if (d.situacao === "vencida") {
    riscos.push(
      `${d.nome}: o período de ${d.periodoPreso.inicio} a ${d.periodoPreso.fim} ` +
        `deveria ter sido concedido até ${d.prazoDeConcessao} e o prazo passou. ` +
        `Restam ${d.saldoEmAberto} dia(s), sujeitos a pagamento em dobro (art. 137).`,
    );
    acoes.push({
      oQue: `Agendar os ${d.saldoEmAberto} dia(s) vencidos e apurar com a folha o que já é devido em dobro`,
      quem: [d.nome, ...(d.gestor ? [d.gestor] : [])],
      ateQuando: null,
    });
  } else if (d.situacao === "crítica" || d.situacao === "atenção") {
    riscos.push(
      `${d.nome}: faltam ${d.diasAteOPrazo} dia(s) para o prazo de ` +
        `${d.prazoDeConcessao}, com ${d.saldoEmAberto} dia(s) em aberto` +
        (d.jaTemFeriasMarcadas ? " (já há férias marcadas)." : " e nada marcado."),
    );
    if (!d.jaTemFeriasMarcadas) {
      acoes.push({
        oQue: `Combinar as datas dos ${d.saldoEmAberto} dia(s) em aberto`,
        quem: [d.nome],
        ateQuando: d.ultimaDataParaSolicitar,
      });
    }
  }

  if (d.cancelamentos >= 2) {
    riscos.push(
      `${d.nome}: ${d.cancelamentos} solicitações canceladas — o planejamento não está se sustentando.`,
    );
  }

  for (const p of d.pendencias) riscos.push(`${d.nome}: ${p.toLowerCase()}`);

  return { riscos, acoes };
}

function parecerDeterministico(f: FatosGerais): Parecer {
  const riscos: string[] = [];
  const acoes: Acao[] = [];

  // Vencidos primeiro, depois críticos — a mesma ordem de prioridade que o
  // modelo receberia como instrução.
  for (const d of f.dossies) {
    const r = riscosDoDossie(d);
    riscos.push(...r.riscos);
    acoes.push(...r.acoes);
  }

  for (const m of f.concentracaoPorMes.filter((m) => m.pessoas.length >= 3)) {
    riscos.push(
      `${m.pessoas.length} pessoas de férias em ${m.mes}: ${m.pessoas.join(", ")}.`,
    );
  }

  const risco: Parecer["risco"] =
    f.vencidas > 0 || f.criticas > 0 ? "alto" : riscos.length > 0 ? "medio" : "baixo";

  const resumo =
    riscos.length === 0
      ? `${f.escopo}: ${f.totalPessoas} pessoa(s), todas com as férias em dia. Nenhum prazo de concessão correndo.`
      : `${f.escopo}: ${f.totalPessoas} pessoa(s), sendo ${f.vencidas} vencida(s), ` +
        `${f.criticas} crítica(s) e ${f.atencao} em atenção. ` +
        `${f.diasEmRiscoDeDobra} dia(s) correm risco de pagamento em dobro.`;

  return {
    risco,
    resumo,
    riscos: riscos.slice(0, 6),
    acoes: acoes.slice(0, 6),
    fromModel: false,
  };
}

function parecerDeterministicoPessoa(d: FatosPessoa): Parecer {
  const { riscos, acoes } = riscosDoDossie(d);
  const risco: Parecer["risco"] =
    d.situacao === "vencida" || d.situacao === "crítica"
      ? "alto"
      : riscos.length > 0
        ? "medio"
        : "baixo";

  const resumo =
    riscos.length === 0
      ? `${d.nome} está com as férias em dia: ${d.diasUsufruidos} dia(s) usufruídos e nenhum prazo correndo.`
      : `${d.nome} tem ${riscos.length} ponto(s) de atenção. ` +
        (d.situacao === "vencida"
          ? "O prazo de concessão já venceu — é o item mais caro da lista."
          : `Prazo de concessão em ${d.prazoDeConcessao}.`);

  return { risco, resumo, riscos, acoes, fromModel: false };
}

/* ------------------------------------------------------------------ */
/* Geração                                                             */
/* ------------------------------------------------------------------ */

type Bruto = {
  risco?: string;
  resumo?: string;
  riscos?: string[];
  acoes?: { oQue?: string; quem?: string[]; ateQuando?: string | null }[];
};

/**
 * Aplica a resposta do modelo por cima do parecer calculado.
 *
 * O modelo escreve; a classificação de risco continua ancorada no cálculo.
 * Prazo vencido é risco alto por definição, e não por opinião do modelo.
 */
function combinar(base: Parecer, bruto: Bruto | null, teto: number): Parecer {
  if (!bruto?.resumo) return base;

  const risco =
    base.risco === "alto"
      ? "alto"
      : bruto.risco === "alto" || bruto.risco === "medio" || bruto.risco === "baixo"
        ? bruto.risco
        : base.risco;

  return {
    risco,
    resumo: bruto.resumo,
    riscos: (bruto.riscos ?? []).filter((r) => typeof r === "string").slice(0, teto),
    acoes: (bruto.acoes ?? [])
      .filter((a) => a && typeof a.oQue === "string")
      .slice(0, teto)
      .map((a) => ({
        oQue: a.oQue as string,
        quem: Array.isArray(a.quem) ? a.quem.filter((q) => typeof q === "string") : [],
        ateQuando: a.ateQuando ?? null,
      })),
    fromModel: true,
  };
}

export async function gerarParecerGeral(
  solicitante: { id: string; role: string },
  todayISO: string = new Date().toISOString().slice(0, 10),
): Promise<{ fatos: FatosGerais; parecer: Parecer }> {
  const fatos = await reunirFatosGerais(solicitante, todayISO);
  const base = parecerDeterministico(fatos);

  const resposta = await askForJson({
    system: PROMPT_GERAL,
    user: JSON.stringify({ hoje: formatBR(todayISO), ...fatos }, null, 2),
    maxTokens: 3000,
  });

  if (!resposta) return { fatos, parecer: base };
  return { fatos, parecer: combinar(base, parseJsonLoose<Bruto>(resposta.text), 6) };
}

export async function gerarParecerIndividual(
  userId: string,
  todayISO: string = new Date().toISOString().slice(0, 10),
): Promise<{ fatos: FatosPessoa; parecer: Parecer } | null> {
  const fatos = await reunirFatosPessoa(userId, todayISO);
  if (!fatos) return null;

  const base = parecerDeterministicoPessoa(fatos);

  const resposta = await askForJson({
    system: PROMPT_INDIVIDUAL,
    user: JSON.stringify({ hoje: formatBR(todayISO), ...fatos }, null, 2),
    maxTokens: 2000,
  });

  if (!resposta) return { fatos, parecer: base };
  return { fatos, parecer: combinar(base, parseJsonLoose<Bruto>(resposta.text), 4) };
}
