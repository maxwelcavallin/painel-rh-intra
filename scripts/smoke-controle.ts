import { config } from "dotenv";

config({ path: ".env.local" });

import { eq } from "drizzle-orm";

import { db } from "../src/db";
import { users, vacationRequests } from "../src/db/schema";
import {
  cancelVacationRequest,
  createVacationRequest,
  decideVacationRequest,
  listOperationalControl,
  markReportedToSenior,
  registerPayment,
  registerReceiptSigned,
} from "../src/server/vacations";

/**
 * Smoke test do controle operacional do RH, ponta a ponta, contra o banco real:
 * solicitar com abono → aprovar em duas mãos → prazo de pagamento → recibo →
 * pagamento → repasse à Senior → cancelamento.
 *
 *   npm run test:controle
 *
 * Este é o caminho que a Thamires percorre todo mês. Usa a IA de verdade na
 * criação (é o ponto: abono precisa chegar inteiro até o agente), então leva
 * alguns segundos por solicitação.
 *
 * DESTRUTIVO: apaga as solicitações de Bruno e Camila. Rode `npm run db:seed`
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

function checkErro(label: string, r: { ok: boolean }, deveFalhar: boolean) {
  if (r.ok === !deveFalhar) {
    passed++;
    console.log(`  ok   ${label}`);
  } else {
    failed++;
    console.error(
      `  FAIL ${label} — obtido: ${"error" in r ? (r as { error: string }).error : "aceito"}`,
    );
  }
}

async function pessoa(email: string) {
  const [u] = await db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!u) throw new Error(`Seed sem ${email}. Rode npm run db:seed.`);
  return u;
}

async function main() {
  const rh = await pessoa("rh@01tecnologia.demo");
  const gestor = await pessoa("rodrigo.gestor@01tecnologia.demo");
  const outroGestor = await pessoa("patricia.gestora@01tecnologia.demo");
  const bruno = await pessoa("bruno.rocha@01tecnologia.demo"); // reporta ao Rodrigo
  const camila = await pessoa("camila.duarte@01tecnologia.demo");

  const limpar = async () => {
    for (const id of [bruno.id, camila.id]) {
      await db.delete(vacationRequests).where(eq(vacationRequests.userId, id));
    }
  };
  await limpar();

  const ator = (u: { id: string; role: string }) => ({
    id: u.id,
    role: u.role as "admin" | "gestor" | "user",
  });

  console.log("\n— Abono pecuniário ponta a ponta (art. 143)");
  // 05/10/2026 é segunda: cumpre os 40 dias de antecedência da política e não
  // cai na véspera de descanso (art. 134 §3º). 20 de gozo + 10 de abono.
  const comAbono = await createVacationRequest({
    userId: bruno.id,
    startDate: "2026-10-05",
    endDate: "2026-10-24",
    abonoDays: 10,
    advance13th: true,
    notes: "Vou vender 10 dias e antecipar o 13º.",
  });
  check("solicitação criada", comAbono.ok, true);
  if (!comAbono.ok) throw new Error(comAbono.error);
  check("não foi barrada", comAbono.status, "pending");

  const [gravado] = await db
    .select()
    .from(vacationRequests)
    .where(eq(vacationRequests.id, comAbono.id));
  check("20 dias de gozo", gravado.days, 20);
  check("10 dias de abono", gravado.abonoDays, 10);
  check("flag de abono ligada", gravado.abonoPecuniario, true);
  check("antecipação do 13º registrada", gravado.advance13th, true);
  check("sem prazo de pagamento antes de aprovar", gravado.paymentDueDate, null);

  console.log("\n— Os dois tetos: um terço (art. 143) e 30 dias (art. 130)");

  /** Cria e devolve o que ficou gravado, para inspecionar os conflitos. */
  async function tentar(params: {
    userId: string;
    startDate: string;
    endDate: string;
    abonoDays: number;
  }) {
    const r = await createVacationRequest({ ...params, advance13th: false, notes: null });
    if (!r.ok) throw new Error(r.error);
    const [row] = await db
      .select({ status: vacationRequests.status, conflicts: vacationRequests.aiConflicts })
      .from(vacationRequests)
      .where(eq(vacationRequests.id, r.id));
    return { id: r.id, ...row, conflicts: row.conflicts as string[] };
  }

  // 19 de gozo + 11 de abono = 30 no total, mas 11 passa do terço.
  const terco = await tentar({
    userId: camila.id,
    startDate: "2026-10-05",
    endDate: "2026-10-23",
    abonoDays: 11,
  });
  check("11 dias de abono: reprovada", terco.status, "rejected");
  check(
    "citando o art. 143",
    terco.conflicts.some((c) => c.includes("143")),
    true,
  );

  // 25 de gozo + 10 de abono = 35: o abono cabe no terço, o total não cabe no ano.
  await db.delete(vacationRequests).where(eq(vacationRequests.userId, camila.id));
  const teto = await tentar({
    userId: camila.id,
    startDate: "2026-10-05",
    endDate: "2026-10-29",
    abonoDays: 10,
  });
  check("35 dias no total: reprovada", teto.status, "rejected");
  check(
    "citando o art. 130",
    teto.conflicts.some((c) => c.includes("130")),
    true,
  );

  console.log("\n— Aprovação em duas mãos");
  checkErro(
    "gestor de outra área não decide",
    await decideVacationRequest({
      requestId: comAbono.id,
      decider: ator(outroGestor),
      decision: "approved",
      note: null,
    }),
    true,
  );

  checkErro(
    "gestor direto aprova",
    await decideVacationRequest({
      requestId: comAbono.id,
      decider: ator(gestor),
      decision: "approved",
      note: "Equipe coberta.",
    }),
    false,
  );

  const [soGestor] = await db
    .select({ status: vacationRequests.status, due: vacationRequests.paymentDueDate })
    .from(vacationRequests)
    .where(eq(vacationRequests.id, comAbono.id));
  check("uma aprovação só não fecha", soGestor.status, "pending");
  check("prazo de pagamento ainda não existe", soGestor.due, null);

  checkErro(
    "RH aprova e fecha",
    await decideVacationRequest({
      requestId: comAbono.id,
      decider: ator(rh),
      decision: "approved",
      note: null,
    }),
    false,
  );

  const [aprovado] = await db
    .select()
    .from(vacationRequests)
    .where(eq(vacationRequests.id, comAbono.id));
  check("aprovada", aprovado.status, "approved");
  // Início segunda 05/10 → 2 dias úteis antes = quinta 01/10.
  check("prazo de pagamento é art. 145", aprovado.paymentDueDate, "2026-10-01");

  console.log("\n— Recibo e pagamento");
  const noControle = await listOperationalControl();
  const linha = noControle.find((r) => r.id === comAbono.id);
  check("aparece no controle operacional", Boolean(linha), true);
  check("recibo ainda não assinado", linha!.receiptSignedAt, null);
  check("ainda não pago", linha!.paidAt, null);

  checkErro(
    "RH registra o recibo",
    await registerReceiptSigned({ requestId: comAbono.id, rhId: rh.id }),
    false,
  );
  checkErro(
    "RH registra o pagamento",
    await registerPayment({ requestId: comAbono.id, rhId: rh.id }),
    false,
  );

  const [quitado] = await db
    .select()
    .from(vacationRequests)
    .where(eq(vacationRequests.id, comAbono.id));
  check("recibo com data", quitado.receiptSignedAt !== null, true);
  check("quem registrou o recibo", quitado.receiptRegisteredBy, rh.id);
  check("pagamento com data", quitado.paidAt !== null, true);
  check("quem pagou", quitado.paidBy, rh.id);

  console.log("\n— Repasse à Senior");
  check("ainda não repassada", quitado.reportedToSeniorAt, null);
  await markReportedToSenior([comAbono.id]);
  const [repassado] = await db
    .select({ at: vacationRequests.reportedToSeniorAt })
    .from(vacationRequests)
    .where(eq(vacationRequests.id, comAbono.id));
  check("marcada como repassada", repassado.at !== null, true);
  await markReportedToSenior([]); // lote vazio não pode explodir
  check("lote vazio é no-op", true, true);

  console.log("\n— Cancelamento");
  checkErro(
    "colega não cancela férias alheias",
    await cancelVacationRequest({
      requestId: comAbono.id,
      actor: ator(camila),
      reason: "curiosidade",
    }),
    true,
  );

  checkErro(
    "dono não cancela o que já foi pago",
    await cancelVacationRequest({
      requestId: comAbono.id,
      actor: ator(bruno),
      reason: "mudei de ideia",
    }),
    true,
  );

  checkErro(
    "RH cancela mesmo pago (estorno)",
    await cancelVacationRequest({
      requestId: comAbono.id,
      actor: ator(rh),
      reason: "Erro de lançamento na folha.",
    }),
    false,
  );

  const [cancelado] = await db
    .select()
    .from(vacationRequests)
    .where(eq(vacationRequests.id, comAbono.id));
  check("status cancelado", cancelado.status, "cancelled");
  check("com carimbo de data", cancelado.cancelledAt !== null, true);
  check("com autor", cancelado.cancelledBy, rh.id);
  check("com motivo", cancelado.cancelReason, "Erro de lançamento na folha.");

  checkErro(
    "cancelar duas vezes não passa",
    await cancelVacationRequest({
      requestId: comAbono.id,
      actor: ator(rh),
      reason: null,
    }),
    true,
  );

  const semCancelada = await listOperationalControl();
  check(
    "cancelada some do controle",
    semCancelada.some((r) => r.id === comAbono.id),
    false,
  );

  console.log("\n— Cancelamento pelo próprio colaborador");
  const doBruno = await createVacationRequest({
    userId: bruno.id,
    startDate: "2026-11-09",
    endDate: "2026-11-23",
    abonoDays: 0,
    advance13th: false,
    notes: null,
  });
  check("criada", doBruno.ok, true);
  if (!doBruno.ok) throw new Error(doBruno.error);

  checkErro(
    "dono cancela a própria pendente",
    await cancelVacationRequest({
      requestId: doBruno.id,
      actor: ator(bruno),
      reason: "Vou remarcar.",
    }),
    false,
  );

  checkErro(
    "decidir uma cancelada não passa",
    await decideVacationRequest({
      requestId: doBruno.id,
      decider: ator(rh),
      decision: "approved",
      note: null,
    }),
    true,
  );

  console.log("\n— Recibo e pagamento só valem em férias aprovadas");
  checkErro(
    "recibo em cancelada é recusado",
    await registerReceiptSigned({ requestId: doBruno.id, rhId: rh.id }),
    true,
  );
  checkErro(
    "pagamento em cancelada é recusado",
    await registerPayment({ requestId: doBruno.id, rhId: rh.id }),
    true,
  );
  checkErro(
    "id inexistente é recusado",
    await registerPayment({
      requestId: "00000000-0000-0000-0000-000000000000",
      rhId: rh.id,
    }),
    true,
  );

  await limpar();

  console.log(
    `\n${failed === 0 ? "✔" : "✖"} ${passed} verificações ok, ${failed} falha(s).\n`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
