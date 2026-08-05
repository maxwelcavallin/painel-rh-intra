import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { users, vacationRequests } from "@/db/schema";
import { daysBetweenInclusive, formatBR } from "@/lib/clt";

import { notify } from "./notifications";

/**
 * Alertas de recibo e pagamento — o trecho do processo onde a multa acontece.
 *
 * A aprovação não gera risco financeiro; o que gera é chegar a data de início
 * com o recibo sem assinatura ou o dinheiro fora da conta (art. 145 da CLT).
 * Esta rotina olha exatamente esses dois pontos.
 */

export type PaymentAlertReport = {
  approved: number;
  paymentOverdue: number;
  paymentDueSoon: number;
  receiptPending: number;
  notified: number;
};

/** Avisa a partir de 5 dias antes do limite — dá tempo de rodar a folha. */
const DUE_SOON_DAYS = 5;

export async function notifyPaymentDeadlines(
  todayISO: string = new Date().toISOString().slice(0, 10),
): Promise<PaymentAlertReport> {
  const rows = await db
    .select({
      id: vacationRequests.id,
      userId: vacationRequests.userId,
      employeeName: users.name,
      startDate: vacationRequests.startDate,
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

  const report: PaymentAlertReport = {
    approved: rows.length,
    paymentOverdue: 0,
    paymentDueSoon: 0,
    receiptPending: 0,
    notified: 0,
  };

  const rhUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.isActive, true)));

  for (const row of rows) {
    // Férias que já começaram saíram da janela de prevenção.
    if (row.startDate < todayISO) continue;

    /* --- Pagamento (art. 145) --- */
    if (!row.paidAt && row.paymentDueDate) {
      const restam = daysBetweenInclusive(todayISO, row.paymentDueDate) - 1;

      if (restam < 0 || restam <= DUE_SOON_DAYS) {
        if (restam < 0) report.paymentOverdue++;
        else report.paymentDueSoon++;

        const urgencia =
          restam < 0
            ? `venceu há ${Math.abs(restam)} dia(s)`
            : `vence em ${restam} dia(s)`;

        for (const rh of rhUsers) {
          await notify({
            type: "vacation_payment",
            userId: rh.id,
            title:
              restam < 0
                ? `Pagamento de férias ATRASADO: ${row.employeeName}`
                : `Pagamento de férias a vencer: ${row.employeeName}`,
            message:
              `As férias de ${row.employeeName} começam em ${formatBR(row.startDate)} ` +
              `e o pagamento ${urgencia} (limite: ${formatBR(row.paymentDueDate)}). ` +
              `O art. 145 da CLT exige o pagamento até 2 dias úteis antes do início.`,
            link: "/ferias/controle",
          });
          report.notified++;
        }
      }
    }

    /* --- Recibo --- */
    if (!row.receiptSignedAt) {
      const ateInicio = daysBetweenInclusive(todayISO, row.startDate) - 1;

      if (ateInicio <= DUE_SOON_DAYS) {
        report.receiptPending++;

        await notify({
          type: "vacation_receipt",
          userId: row.userId,
          title: "Recibo de férias pendente",
          message:
            `Suas férias começam em ${formatBR(row.startDate)} e o recibo ainda ` +
            `não foi assinado. Procure o RH para regularizar antes de sair.`,
          link: "/ferias/minhas",
        });
        report.notified++;

        for (const rh of rhUsers) {
          await notify({
            type: "vacation_receipt",
            userId: rh.id,
            title: `Recibo pendente: ${row.employeeName}`,
            message:
              `${row.employeeName} inicia férias em ${formatBR(row.startDate)} ` +
              `e o recibo ainda não foi assinado.`,
            link: "/ferias/controle",
          });
          report.notified++;
        }
      }
    }
  }

  return report;
}
