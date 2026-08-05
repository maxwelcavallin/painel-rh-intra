import { config } from "dotenv";

config({ path: ".env.local" });

import { and, eq } from "drizzle-orm";

import { db } from "../src/db";
import { notifications, users, vacationRequests } from "../src/db/schema";
import { vacationDeadlineFor } from "../src/lib/clt";
import {
  listVacationStatus,
  notifyExpiringVacations,
} from "../src/server/vacation-deadlines";
import { notifyPaymentDeadlines } from "../src/server/vacation-alerts";

/**
 * Smoke test do vencimento de férias e dos alertas de pagamento/recibo,
 * contra o banco real.
 *
 *   npm run test:vencimentos
 *
 * Cobre o que o `test:clt2` não alcança: o cálculo puro já estava testado, mas
 * a CONSULTA que o alimenta (juntando admissão, aprovações e cancelamentos)
 * nunca tinha rodado. Foi aqui que apareceu o bug do "vencido inalcançável".
 *
 * Todas as funções aceitam `todayISO` — o teste controla o relógio em vez de
 * depender do dia em que rodar.
 *
 * DESTRUTIVO: apaga todas as solicitações de férias e notificações para montar
 * cada cenário do zero. As pessoas continuam intactas. Rode `npm run db:seed`
 * depois para recompor os dados de demonstração (ou use `npm run test:all`).
 */

let passed = 0;
let failed = 0;

function check(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed++;
    console.log(`  ok   ${label}`);
  } else {
    failed++;
    console.error(
      `  FAIL ${label}\n         esperado: ${JSON.stringify(expected)}\n         obtido:   ${JSON.stringify(actual)}`,
    );
  }
}

async function pessoa(email: string) {
  const [u] = await db
    .select({ id: users.id, name: users.name, admissionDate: users.admissionDate })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!u) throw new Error(`Seed sem ${email}. Rode npm run db:seed.`);
  return u;
}

/** Grava férias aprovadas direto, sem passar pelo agente — o foco aqui é o saldo. */
async function aprovadas(userId: string, start: string, end: string, days: number) {
  await db.insert(vacationRequests).values({
    userId,
    startDate: start,
    endDate: end,
    days,
    status: "approved",
    rhApproval: "approved",
    managerApproval: "approved",
  });
}

async function main() {
  const bruno = await pessoa("bruno.rocha@01tecnologia.demo"); // admissão 2022-08-15
  const larissa = await pessoa("larissa.peixoto@01tecnologia.demo"); // 2024-05-13

  const limpar = async () => {
    await db.delete(vacationRequests).where(eq(vacationRequests.userId, bruno.id));
  };

  // Zera o histórico de TODO MUNDO: as contagens de alerta são globais e o seed
  // de demonstração traz férias aprovadas que somariam junto. O que este teste
  // mede é o cálculo, não o conteúdo do seed.
  await db.delete(vacationRequests);

  console.log("\n— listVacationStatus cobre todo mundo com admissão");
  const status = await listVacationStatus("2026-08-05");
  check("7 pessoas do seed", status.length, 7);
  check(
    "todas com prazo de concessão calculado",
    status.every((s) => /^\d{4}-\d{2}-\d{2}$/.test(s.deadline.concessiveEnd)),
    true,
  );
  check(
    "ordenado pelo prazo mais apertado primeiro",
    status[0].deadline.daysUntilDeadline <=
      status[status.length - 1].deadline.daysUntilDeadline,
    true,
  );

  console.log("\n— A consulta bate com o cálculo puro");
  const doBruno = status.find((s) => s.userId === bruno.id)!;
  const esperado = vacationDeadlineFor(bruno.admissionDate!, "2026-08-05", 0);
  check("mesmo prazo", doBruno.deadline.concessiveEnd, esperado.concessiveEnd);
  check("mesmo período preso", doBruno.deadline.acquisitive, esperado.acquisitive);

  console.log("\n— Seed sem histórico de férias: prazo antigo JÁ vencido");
  // Bruno entrou em 2022 e nunca tirou férias. O período 2022-2023 tinha de ser
  // concedido até 14/08/2024 — passou. É o caso que o RH chama de "vencida".
  check("período preso é o de 2022-2023", doBruno.deadline.acquisitive, {
    start: "2022-08-15",
    end: "2023-08-14",
  });
  check("marcado como vencido", doBruno.severity, "expired");
  check("dias negativos", doBruno.deadline.daysUntilDeadline < 0, true);
  check("30 dias em aberto", doBruno.daysRemaining, 30);

  console.log("\n— Quem entrou depois prende um período mais novo");
  // Larissa entrou em 13/05/2024; em 05/08/2026 já fecharam 24-25 e 25-26.
  // Sem histórico, o que prende é o primeiro, com concessão até 12/05/2026.
  const daLarissa = status.find((s) => s.userId === larissa.id)!;
  check("prende o ciclo 2024-2025", daLarissa.deadline.acquisitive, {
    start: "2024-05-13",
    end: "2025-05-12",
  });
  check("prazo mais folgado que o do Bruno", daLarissa.deadline.concessiveEnd > doBruno.deadline.concessiveEnd, true);

  console.log("\n— Quitar períodos empurra o prazo para frente");
  await aprovadas(bruno.id, "2024-03-04", "2024-04-02", 30);
  const com30 = (await listVacationStatus("2026-08-05")).find((s) => s.userId === bruno.id)!;
  check("30 dias quitam o primeiro período", com30.daysTaken, 30);
  check("passa a prender 2023-2024", com30.deadline.acquisitive, {
    start: "2023-08-15",
    end: "2024-08-14",
  });
  check("esse também já venceu", com30.severity, "expired");

  await aprovadas(bruno.id, "2025-03-03", "2025-04-01", 30);
  const com60 = (await listVacationStatus("2026-08-05")).find((s) => s.userId === bruno.id)!;
  check("60 dias quitam dois períodos", com60.daysTaken, 60);
  check("agora prende 2024-2025", com60.deadline.acquisitive, {
    start: "2024-08-15",
    end: "2025-08-14",
  });
  check("prazo 14/08/2026, a 9 dias: crítico", com60.severity, "critical");

  const emJunho = (await listVacationStatus("2026-06-01")).find((s) => s.userId === bruno.id)!;
  check("dois meses antes: atenção", emJunho.severity, "warning");
  check("férias passadas não contam como agendamento", emJunho.hasScheduled, false);

  console.log("\n— Férias já marcadas dentro do prazo tiram a urgência");
  await db.insert(vacationRequests).values({
    userId: bruno.id,
    startDate: "2026-07-06",
    endDate: "2026-08-04",
    days: 30,
    status: "pending",
  });
  const marcado = (await listVacationStatus("2026-06-01")).find((s) => s.userId === bruno.id)!;
  check("pendente futura conta como agendada", marcado.hasScheduled, true);
  check("sai do 'atenção'", marcado.severity, "ok");
  check("mas não soma no usufruído", marcado.daysTaken, 60);
  await db
    .delete(vacationRequests)
    .where(
      and(
        eq(vacationRequests.userId, bruno.id),
        eq(vacationRequests.startDate, "2026-07-06"),
      ),
    );

  await aprovadas(bruno.id, "2026-03-02", "2026-03-31", 30);
  const com90 = (await listVacationStatus("2026-08-05")).find((s) => s.userId === bruno.id)!;
  check("90 dias quitam os três fechados", com90.daysTaken, 90);
  check("nada em aberto", com90.deadline.settled, true);
  check("situação em dia", com90.severity, "ok");

  console.log("\n— Abono consome saldo igual ao gozo");
  await limpar();
  await db.insert(vacationRequests).values({
    userId: bruno.id,
    startDate: "2024-03-04",
    endDate: "2024-03-23",
    days: 20,
    abonoDays: 10,
    status: "approved",
    rhApproval: "approved",
    managerApproval: "approved",
  });
  const comAbono = (await listVacationStatus("2026-08-05")).find((s) => s.userId === bruno.id)!;
  check("20 de gozo + 10 de abono = 30", comAbono.daysTaken, 30);
  check("quitou o período inteiro", comAbono.deadline.acquisitive, {
    start: "2023-08-15",
    end: "2024-08-14",
  });

  console.log("\n— Cancelada devolve o saldo");
  await db
    .update(vacationRequests)
    .set({ status: "cancelled", cancelledAt: new Date() })
    .where(eq(vacationRequests.userId, bruno.id));
  const cancelado = (await listVacationStatus("2026-08-05")).find((s) => s.userId === bruno.id)!;
  check("saldo devolvido", cancelado.daysTaken, 0);
  check("volta a prender o período mais antigo", cancelado.deadline.acquisitive, {
    start: "2022-08-15",
    end: "2023-08-14",
  });

  console.log("\n— Rejeitada é ignorada por completo");
  await limpar();
  await db.insert(vacationRequests).values({
    userId: bruno.id,
    startDate: "2026-09-14",
    endDate: "2026-10-13",
    days: 30,
    status: "rejected",
  });
  const rejeitado = (await listVacationStatus("2026-08-05")).find((s) => s.userId === bruno.id)!;
  check("não soma no usufruído", rejeitado.daysTaken, 0);
  check("não conta como agendamento", rejeitado.hasScheduled, false);
  check("continua vencido", rejeitado.severity, "expired");

  console.log("\n— notifyExpiringVacations avisa colaborador E gestor");
  await limpar();
  await db.delete(notifications);
  const aviso = await notifyExpiringVacations("2026-08-05");
  check("checou as 7 pessoas", aviso.checked, 7);
  check("achou gente vencida", aviso.expired > 0, true);
  check("notificou", aviso.notified > 0, true);

  const geradas = await db.select({ userId: notifications.userId }).from(notifications);
  check("gerou notificação in-app", geradas.length > 0, true);
  check(
    "o gestor também recebeu, não só o colaborador",
    geradas.some((n) => n.userId !== bruno.id),
    true,
  );

  console.log("\n— notifyPaymentDeadlines: prazo do art. 145");
  await db.delete(notifications);
  await limpar();

  // Férias aprovadas começando 14/09/2026 (segunda) → pagar até 10/09 (quinta).
  await db.insert(vacationRequests).values({
    userId: bruno.id,
    startDate: "2026-09-14",
    endDate: "2026-09-27",
    days: 14,
    status: "approved",
    rhApproval: "approved",
    managerApproval: "approved",
    paymentDueDate: "2026-09-10",
  });

  const longe = await notifyPaymentDeadlines("2026-08-05");
  check("longe do prazo não alerta", longe.paymentOverdue + longe.paymentDueSoon, 0);

  const perto = await notifyPaymentDeadlines("2026-09-08");
  check("2 dias antes do limite: alerta", perto.paymentDueSoon, 1);
  check("ainda não atrasado", perto.paymentOverdue, 0);

  const atrasado = await notifyPaymentDeadlines("2026-09-12");
  check("passou do limite: atrasado", atrasado.paymentOverdue, 1);
  check("recibo pendente também acusa", atrasado.receiptPending, 1);
  check("notificou", atrasado.notified > 0, true);

  console.log("\n— Pago e assinado param de alertar");
  await db
    .update(vacationRequests)
    .set({ paidAt: new Date(), receiptSignedAt: new Date() })
    .where(eq(vacationRequests.userId, bruno.id));

  const quitado = await notifyPaymentDeadlines("2026-09-12");
  check("sem alerta de pagamento", quitado.paymentOverdue, 0);
  check("sem alerta de recibo", quitado.receiptPending, 0);

  console.log("\n— Férias que já começaram saem da janela de prevenção");
  await db
    .update(vacationRequests)
    .set({ paidAt: null, receiptSignedAt: null })
    .where(eq(vacationRequests.userId, bruno.id));

  const jaComecou = await notifyPaymentDeadlines("2026-09-20");
  check("não alerta retroativamente", jaComecou.paymentOverdue, 0);

  await limpar();
  await db.delete(notifications);

  console.log(
    `\n${failed === 0 ? "✔" : "✖"} ${passed} verificações ok, ${failed} falha(s).\n`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
