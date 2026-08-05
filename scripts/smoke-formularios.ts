import { config } from "dotenv";

config({ path: ".env.local" });

import { eq, inArray } from "drizzle-orm";

import { db } from "../src/db";
import { formResponses, forms, notifications, users } from "../src/db/schema";
import type { FormQuestion } from "../src/db/schema";
import {
  createForm,
  getScoreboard,
  listFormsForDashboard,
  listFormsForUser,
  sendPendingReminders,
  submitResponse,
  validateQuestions,
} from "../src/server/forms";

/**
 * Smoke test dos formulários contra o banco real.
 *
 *   npm run test:formularios
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

const perguntas: FormQuestion[] = [
  { id: "q1", label: "Prefere qual data?", type: "radio", required: true, options: ["12/12", "19/12"] },
  { id: "q2", label: "Restrição alimentar?", type: "text", required: false },
];

async function main() {
  const pessoa = async (email: string) => {
    const [u] = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!u) throw new Error(`Seed sem ${email}. Rode npm run db:seed.`);
    return u;
  };

  const rh = await pessoa("rh@01tecnologia.demo");
  const gestorTec = await pessoa("rodrigo.gestor@01tecnologia.demo");
  const gestorOps = await pessoa("patricia.gestora@01tecnologia.demo");
  const bruno = await pessoa("bruno.rocha@01tecnologia.demo");
  const camila = await pessoa("camila.duarte@01tecnologia.demo");
  const tiago = await pessoa("tiago.lins@01tecnologia.demo");

  console.log("\n— Validação das perguntas");
  check("lista vazia rejeitada", validateQuestions([]), "Adicione ao menos uma pergunta.");
  check(
    "enunciado vazio rejeitado",
    validateQuestions([{ id: "a", label: "  ", type: "text", required: true }]) !== null,
    true,
  );
  check(
    "múltipla escolha com 1 opção rejeitada",
    validateQuestions([
      { id: "a", label: "X", type: "radio", required: true, options: ["só uma"] },
    ]) !== null,
    true,
  );
  check("perguntas boas aceitas", validateQuestions(perguntas), null);

  console.log("\n— Criação (audiência: papel colaborador)");
  const criado = await createForm({
    title: "[teste] Confraternização",
    description: "Escolha a data.",
    questions: perguntas,
    audience: { type: "role", value: "user" },
    reminderAfterHours: 48,
    createdBy: rh.id,
  });
  check("criado", criado.ok, true);
  if (!criado.ok) throw new Error(criado.error);
  check("4 colaboradores na audiência", criado.recipients, 4);

  console.log("\n— Visibilidade");
  const doBruno = await listFormsForUser(bruno.id);
  check("colaborador vê o formulário", doBruno.some((f) => f.id === criado.id), true);
  const doGestor = await listFormsForUser(gestorTec.id);
  check("gestor fora da audiência NÃO vê", doGestor.some((f) => f.id === criado.id), false);

  console.log("\n— Resposta");
  const foraDaAudiencia = await submitResponse({
    formId: criado.id,
    userId: gestorTec.id,
    answers: { q1: "12/12" },
  });
  check("quem não é da audiência não responde", foraDaAudiencia.ok, false);

  const semObrigatoria = await submitResponse({
    formId: criado.id,
    userId: bruno.id,
    answers: { q2: "nenhuma" },
  });
  check("pergunta obrigatória em branco rejeitada", semObrigatoria.ok, false);

  const ok1 = await submitResponse({
    formId: criado.id,
    userId: bruno.id,
    answers: { q1: "12/12", q2: "nenhuma" },
  });
  check("Bruno respondeu", ok1.ok, true);

  const ok2 = await submitResponse({
    formId: criado.id,
    userId: camila.id,
    answers: { q1: "19/12" },
  });
  check("Camila respondeu", ok2.ok, true);

  console.log("\n— Reenvio substitui, não duplica");
  const reenvio = await submitResponse({
    formId: criado.id,
    userId: bruno.id,
    answers: { q1: "19/12", q2: "mudei de ideia" },
  });
  check("reenvio aceito", reenvio.ok, true);
  const respostasBruno = await db
    .select({ id: formResponses.id })
    .from(formResponses)
    .where(eq(formResponses.formId, criado.id));
  check("2 respostas no total (não 3)", respostasBruno.length, 2);

  console.log("\n— Placar");
  const geral = await getScoreboard(criado.id, null);
  check("2 responderam", geral?.responded.length, 2);
  check("2 faltando", geral?.missing.length, 2);

  console.log("\n— Escopo do gestor: só a própria equipe");
  const placarTec = await getScoreboard(criado.id, gestorTec.id);
  check("Rodrigo vê 2 pessoas (Bruno e Camila)", (placarTec?.responded.length ?? 0) + (placarTec?.missing.length ?? 0), 2);
  check("e ambas já responderam", placarTec?.missing.length, 0);

  const placarOps = await getScoreboard(criado.id, gestorOps.id);
  check("Patrícia vê 2 pessoas (Tiago e Larissa)", (placarOps?.responded.length ?? 0) + (placarOps?.missing.length ?? 0), 2);
  check("as duas faltando", placarOps?.missing.length, 2);
  check(
    "Patrícia NÃO vê ninguém da equipe do Rodrigo",
    placarOps?.missing.some((p) => p.id === bruno.id || p.id === camila.id),
    false,
  );

  console.log("\n— Painel por papel");
  const painelRH = await listFormsForDashboard({ id: rh.id, role: "admin" });
  check("RH vê o formulário", painelRH.some((f) => f.id === criado.id), true);
  const painelGestor = await listFormsForDashboard({ id: gestorOps.id, role: "gestor" });
  const doPainel = painelGestor.find((f) => f.id === criado.id);
  check("gestor vê com o total da própria equipe", doPainel?.total, 2);

  console.log("\n— Lembrete: nada a cobrar antes do prazo");
  const cedo = await sendPendingReminders();
  check("nenhum formulário vencido", cedo.formsOverdue, 0);

  console.log("\n— Lembrete: vencido cobra UM gestor por vez, consolidado");
  // Empurra a criação para trás para vencer o prazo de 48h.
  await db
    .update(forms)
    .set({ createdAt: new Date(Date.now() - 72 * 3_600_000) })
    .where(eq(forms.id, criado.id));

  const vencido = await sendPendingReminders();
  check("1 formulário vencido", vencido.formsOverdue, 1);
  check("2 pessoas pendentes", vencido.peoplePending, 2);
  check("1 gestor avisado (só a Patrícia tem faltantes)", vencido.managersNotified, 1);
  check("é a Patrícia", vencido.details[0]?.manager.startsWith("Patrícia"), true);
  check("com os dois nomes numa mensagem só", vencido.details[0]?.pending.length, 2);

  console.log("\n— Não recobra dentro da mesma janela");
  const denovo = await sendPendingReminders();
  check("segunda passada não cobra de novo", denovo.managersNotified, 0);

  console.log("\n— Depois que todos respondem, para de cobrar");
  await submitResponse({ formId: criado.id, userId: tiago.id, answers: { q1: "12/12" } });
  const larissa = await pessoa("larissa.peixoto@01tecnologia.demo");
  await submitResponse({ formId: criado.id, userId: larissa.id, answers: { q1: "12/12" } });
  await db
    .update(forms)
    .set({ lastReminderAt: null, createdAt: new Date(Date.now() - 72 * 3_600_000) })
    .where(eq(forms.id, criado.id));

  const completo = await sendPendingReminders();
  check("ninguém mais a cobrar", completo.managersNotified, 0);

  const placarFinal = await getScoreboard(criado.id, null);
  check("4 de 4 responderam", placarFinal?.responded.length, 4);
  check("0 faltando", placarFinal?.missing.length, 0);

  // Limpeza
  await db.delete(formResponses).where(eq(formResponses.formId, criado.id));
  await db.delete(forms).where(inArray(forms.id, [criado.id]));
  await db.delete(notifications).where(eq(notifications.link, `/formularios/${criado.id}`));
  await db.delete(notifications).where(eq(notifications.link, "/formularios/painel"));

  console.log(
    `\n${failed === 0 ? "✔" : "✖"} ${passed} verificações ok, ${failed} falha(s).\n`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
