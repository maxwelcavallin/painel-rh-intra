import "server-only";

import { and, asc, eq, gte, isNull, or } from "drizzle-orm";

import { db } from "@/db";
import { institutionalEvents } from "@/db/schema";
import type { InstitutionalEvent } from "@/db/schema";

/**
 * Eventos institucionais — os períodos em que a empresa preferia não ter gente
 * de férias.
 *
 * Quem cadastra é o RH. A autorização NÃO é checada aqui: quem chama (Server
 * Action ou page) já passou pelo `requireRH`. O que este módulo garante é a
 * integridade do dado — período coerente e setor normalizado.
 */

export type EventInput = {
  title: string;
  startDate: string;
  endDate: string;
  /** Vazio/null = empresa inteira. */
  sector: string | null;
};

export type SaveResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

function validate(input: EventInput): string | null {
  if (!input.title.trim()) return "Informe o nome do evento.";
  if (!input.startDate) return "Informe a data de início.";
  if (!input.endDate) return "Informe a data de término.";
  if (input.endDate < input.startDate) {
    return "O término não pode ser antes do início.";
  }
  return null;
}

function toRow(input: EventInput) {
  const sector = input.sector?.trim();
  return {
    title: input.title.trim(),
    startDate: input.startDate,
    endDate: input.endDate,
    // Setor vazio e "empresa inteira" são a mesma coisa: NULL.
    sector: sector ? sector : null,
    updatedAt: new Date(),
  };
}

export async function createEvent(
  input: EventInput,
  createdBy: string,
): Promise<SaveResult> {
  const invalid = validate(input);
  if (invalid) return { ok: false, error: invalid };

  const [created] = await db
    .insert(institutionalEvents)
    .values({ ...toRow(input), createdBy })
    .returning({ id: institutionalEvents.id });

  return { ok: true, id: created.id };
}

export async function updateEvent(
  id: string,
  input: EventInput,
): Promise<SaveResult> {
  const invalid = validate(input);
  if (invalid) return { ok: false, error: invalid };

  await db
    .update(institutionalEvents)
    .set(toRow(input))
    .where(eq(institutionalEvents.id, id));

  return { ok: true, id };
}

export async function deleteEvent(id: string): Promise<void> {
  await db.delete(institutionalEvents).where(eq(institutionalEvents.id, id));
}

export async function getEvent(id: string): Promise<InstitutionalEvent | null> {
  const [row] = await db
    .select()
    .from(institutionalEvents)
    .where(eq(institutionalEvents.id, id))
    .limit(1);
  return row ?? null;
}

/** Todos os eventos, mais recentes por último. Tela do RH. */
export function listEvents(): Promise<InstitutionalEvent[]> {
  return db
    .select()
    .from(institutionalEvents)
    .orderBy(asc(institutionalEvents.startDate));
}

/**
 * Eventos que ainda valem para uma pessoa: os da empresa inteira mais os do
 * setor dela.
 *
 * Corta o que já terminou — quem vai pedir férias só precisa saber do que está
 * pela frente, e a data mínima do formulário já é hoje + antecedência.
 */
export function listUpcomingEventsFor(
  sector: string | null,
  hoje: string,
): Promise<InstitutionalEvent[]> {
  const abrangencia = sector
    ? or(isNull(institutionalEvents.sector), eq(institutionalEvents.sector, sector))
    : isNull(institutionalEvents.sector);

  return db
    .select()
    .from(institutionalEvents)
    .where(and(gte(institutionalEvents.endDate, hoje), abrangencia))
    .orderBy(asc(institutionalEvents.startDate));
}

/** Eventos que encostam no ano pedido — alimenta o calendário. */
export async function listEventsForYear(
  year: number,
): Promise<InstitutionalEvent[]> {
  const rows = await listEvents();
  return rows.filter(
    (e) =>
      e.startDate.slice(0, 4) === String(year) ||
      e.endDate.slice(0, 4) === String(year) ||
      (e.startDate < `${year}-01-01` && e.endDate > `${year}-12-31`),
  );
}
