import "server-only";

import { and, eq, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import { users, vacationRequests } from "@/db/schema";

import { getHolidays, type Holiday } from "./holidays";
import { listEventsForYear } from "./institutional-events";

/**
 * Calendário: férias APROVADAS, feriados e aniversários.
 *
 * Visível a qualquer colaborador logado — é informação de convivência, não dado
 * sensível. Ainda assim, só sai daqui nome e período: nada de CPF, endereço ou
 * o ano de nascimento (só dia/mês, para não expor idade).
 */

export type VacationEntry = {
  id: string;
  name: string;
  sector: string | null;
  start: string;
  end: string;
  days: number;
};

export type BirthdayEntry = {
  id: string;
  name: string;
  /** `MM-DD` — o ano é deliberadamente descartado. */
  monthDay: string;
};

export type EventEntry = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  /** NULL = empresa inteira. */
  sector: string | null;
};

export type CalendarData = {
  vacations: VacationEntry[];
  holidays: Holiday[];
  birthdays: BirthdayEntry[];
  events: EventEntry[];
};

export async function getCalendarData(year: number): Promise<CalendarData> {
  const [vacationRows, holidays, birthdayRows, eventRows] = await Promise.all([
    db
      .select({
        id: vacationRequests.id,
        name: users.name,
        sector: users.sector,
        start: vacationRequests.startDate,
        end: vacationRequests.endDate,
        days: vacationRequests.days,
      })
      .from(vacationRequests)
      .innerJoin(users, eq(users.id, vacationRequests.userId))
      // Só aprovadas — pendente e reprovada não aparecem para a empresa.
      .where(eq(vacationRequests.status, "approved"))
      .orderBy(vacationRequests.startDate),

    getHolidays(year),

    db
      .select({ id: users.id, name: users.name, birthDate: users.birthDate })
      .from(users)
      .where(and(eq(users.isActive, true), isNotNull(users.birthDate)))
      .orderBy(users.name),

    // Sem recorte por setor: o calendário é a visão de convivência da empresa,
    // e saber que o setor vizinho está em inventário é justamente o ponto.
    listEventsForYear(year),
  ]);

  return {
    // Mantém quem encosta no ano pedido, mesmo começando ou terminando fora dele.
    vacations: vacationRows.filter(
      (v) => v.start.slice(0, 4) === String(year) || v.end.slice(0, 4) === String(year),
    ),
    holidays,
    birthdays: birthdayRows
      .filter((b) => b.birthDate)
      .map((b) => ({
        id: b.id,
        name: b.name,
        monthDay: b.birthDate!.slice(5),
      })),
    events: eventRows.map((e) => ({
      id: e.id,
      title: e.title,
      startDate: e.startDate,
      endDate: e.endDate,
      sector: e.sector,
    })),
  };
}
