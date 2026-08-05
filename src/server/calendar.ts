import "server-only";

import { and, eq, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import { users, vacationRequests } from "@/db/schema";

import { getHolidays, type Holiday } from "./holidays";

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

export type CalendarData = {
  vacations: VacationEntry[];
  holidays: Holiday[];
  birthdays: BirthdayEntry[];
};

export async function getCalendarData(year: number): Promise<CalendarData> {
  const [vacationRows, holidays, birthdayRows] = await Promise.all([
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
  };
}
