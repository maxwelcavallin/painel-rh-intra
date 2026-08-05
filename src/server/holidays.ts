import { addDaysToDate, easterSunday } from "@/lib/clt";

/**
 * Feriados nacionais + Paraná + Curitiba.
 *
 * Alimenta dois lugares: o calendário (visual) e `facts.ts` (contexto da IA).
 *
 * Nacionais vêm da BrasilAPI, MAS com cálculo local como fallback — este é o
 * insumo de uma regra que BLOQUEIA a solicitação (art. 134 §3º CLT). Se a API
 * cair, a regra não pode silenciosamente parar de valer: o cálculo local
 * (incluindo as datas móveis derivadas da Páscoa) mantém o bloqueio de pé.
 *
 * Estadual (PR) e municipal (Curitiba) não têm API pública confiável — ficam
 * como config estática. CONFIRMAR a lista com o RH antes de ir pro ar: a fonte
 * é pesquisa pública, não o decreto oficial em si.
 *
 * Sem `server-only` de propósito: não há segredo aqui, e o smoke test das
 * regras da CLT precisa importar as tabelas sem subir o runtime do Next.
 */

export type Holiday = {
  /** ISO `YYYY-MM-DD`. */
  date: string;
  name: string;
  scope: "nacional" | "estadual" | "municipal";
};

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Nacionais calculados localmente — fonte de verdade quando a BrasilAPI falha. */
export function nationalHolidaysLocal(year: number): Holiday[] {
  const easter = easterSunday(year);

  return [
    { date: iso(year, 1, 1), name: "Confraternização Universal", scope: "nacional" },
    { date: addDaysToDate(easter, -48), name: "Carnaval", scope: "nacional" },
    { date: addDaysToDate(easter, -47), name: "Carnaval", scope: "nacional" },
    { date: addDaysToDate(easter, -2), name: "Sexta-feira Santa", scope: "nacional" },
    { date: addDaysToDate(easter, 60), name: "Corpus Christi", scope: "nacional" },
    { date: iso(year, 4, 21), name: "Tiradentes", scope: "nacional" },
    { date: iso(year, 5, 1), name: "Dia do Trabalho", scope: "nacional" },
    { date: iso(year, 9, 7), name: "Independência do Brasil", scope: "nacional" },
    { date: iso(year, 10, 12), name: "Nossa Senhora Aparecida", scope: "nacional" },
    { date: iso(year, 11, 2), name: "Finados", scope: "nacional" },
    { date: iso(year, 11, 15), name: "Proclamação da República", scope: "nacional" },
    { date: iso(year, 11, 20), name: "Consciência Negra", scope: "nacional" },
    { date: iso(year, 12, 25), name: "Natal", scope: "nacional" },
  ];
}

/**
 * Estadual (PR) e municipal (Curitiba).
 * Datas fixas — valem para qualquer ano. Corpus Christi de Curitiba coincide
 * com o nacional móvel e já vem de `nationalHolidaysLocal`.
 */
export function regionalHolidays(year: number): Holiday[] {
  return [
    {
      date: iso(year, 3, 29),
      name: "Aniversário de Curitiba",
      scope: "municipal",
    },
    {
      date: iso(year, 9, 8),
      name: "Nossa Senhora da Luz dos Pinhais (padroeira de Curitiba)",
      scope: "municipal",
    },
    {
      date: iso(year, 12, 19),
      name: "Emancipação Política do Paraná",
      scope: "estadual",
    },
  ];
}

type BrasilApiHoliday = { date: string; name: string; type: string };

async function fetchNationalHolidays(year: number): Promise<Holiday[] | null> {
  try {
    const response = await fetch(
      `https://brasilapi.com.br/api/feriados/v1/${year}`,
      {
        // Feriado do ano não muda; 24h de cache é folgado.
        next: { revalidate: 86_400 },
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!response.ok) return null;

    const data = (await response.json()) as BrasilApiHoliday[];
    if (!Array.isArray(data) || data.length === 0) return null;

    return data.map((h) => ({
      date: h.date,
      name: h.name,
      scope: "nacional" as const,
    }));
  } catch {
    return null;
  }
}

/** Junta, deduplica por data e ordena. */
export function mergeHolidays(lists: Holiday[][]): Holiday[] {
  const byDate = new Map<string, Holiday>();
  for (const holiday of lists.flat()) {
    if (!byDate.has(holiday.date)) byDate.set(holiday.date, holiday);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Lista consolidada para o ano. Nunca lança: se a rede falhar, cai no
 * cálculo local para que o bloqueio legal continue valendo.
 */
export async function getHolidays(year: number): Promise<Holiday[]> {
  const fromApi = await fetchNationalHolidays(year);

  if (!fromApi) {
    console.warn(
      `[holidays] BrasilAPI indisponível para ${year}; usando cálculo local.`,
    );
  }

  return mergeHolidays([
    fromApi ?? nationalHolidaysLocal(year),
    regionalHolidays(year),
  ]);
}

/** Feriados cobrindo o intervalo inteiro, atravessando a virada de ano. */
export async function getHolidaysForRange(
  startISO: string,
  endISO: string,
): Promise<Holiday[]> {
  const startYear = Number(startISO.slice(0, 4));
  const endYear = Number(endISO.slice(0, 4));

  const years: number[] = [];
  for (let y = startYear; y <= endYear; y++) years.push(y);

  const lists = await Promise.all(years.map(getHolidays));
  return lists.flat();
}
