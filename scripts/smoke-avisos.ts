import { config } from "dotenv";

config({ path: ".env.local" });

import { eq, inArray } from "drizzle-orm";

import { db } from "../src/db";
import { broadcastDeliveries, broadcasts, notifications, users } from "../src/db/schema";
import { describeAudience, resolveAudience } from "../src/server/audience";
import {
  createAndSendBroadcast,
  getBroadcastDeliveries,
} from "../src/server/broadcasts";

/**
 * Smoke test dos avisos do RH contra o banco real.
 *
 *   npm run test:avisos
 *
 * ATENÇÃO: com DISCORD_WEBHOOK_URL configurado, isto PUBLICA de verdade no
 * canal. Use um canal de teste, ou esvazie a env var antes de rodar.
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

async function main() {
  const [rh] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "rh@01tecnologia.demo"))
    .limit(1);
  if (!rh) throw new Error("Seed não encontrado. Rode `npm run db:seed`.");

  console.log("\n— Resolução de audiência");
  const todos = await resolveAudience({ type: "all", value: null });
  check("todos os ativos", todos.length, 7);

  const tecnologia = await resolveAudience({ type: "sector", value: "Tecnologia" });
  check("setor Tecnologia", tecnologia.length, 3);

  const gestores = await resolveAudience({ type: "role", value: "gestor" });
  check("papel gestor", gestores.length, 2);

  const rmc = await resolveAudience({ type: "location", value: "rmc" });
  check("dentro da RMC (Patrícia mora em Blumenau)", rmc.length, 6);

  const foraRmc = await resolveAudience({ type: "location", value: "fora_rmc" });
  check("fora da RMC", foraRmc.length, 1);
  check("é a Patrícia", foraRmc[0]?.name.startsWith("Patrícia"), true);

  console.log("\n— Audiência sem valor não vira 'todo mundo'");
  // Um bug clássico: setor não escolhido caindo no fallback e avisando a empresa.
  const setorVazio = await resolveAudience({ type: "sector", value: null });
  check("setor sem valor seleciona ninguém", setorVazio.length, 0);
  const papelVazio = await resolveAudience({ type: "role", value: null });
  check("papel sem valor seleciona ninguém", papelVazio.length, 0);

  console.log("\n— Rótulos de audiência");
  check(
    "localização dentro",
    describeAudience({ type: "location", value: "rmc" }),
    "Região Metropolitana de Curitiba",
  );
  check(
    "localização fora",
    describeAudience({ type: "location", value: "fora_rmc" }),
    "Fora da Região Metropolitana de Curitiba",
  );

  console.log("\n— Envio sem canal externo (só in-app)");
  const antes = await db.select({ id: notifications.id }).from(notifications);

  const soInApp = await createAndSendBroadcast({
    title: "[teste] Aviso só na intranet",
    body: "Este aviso não usa canal externo.",
    audience: { type: "sector", value: "Tecnologia" },
    channels: [],
    createdBy: rh.id,
  });
  check("enviado", soInApp.ok, true);
  if (!soInApp.ok) throw new Error(soInApp.error);
  check("3 destinatários", soInApp.recipients, 3);

  const depois = await db.select({ id: notifications.id }).from(notifications);
  check("criou 3 notificações in-app", depois.length - antes.length, 3);

  const semEntregas = await getBroadcastDeliveries(soInApp.id);
  check("nenhuma entrega externa registrada", semEntregas.length, 0);

  console.log("\n— Envio com WhatsApp: uma entrega POR PESSOA");
  const comWhats = await createAndSendBroadcast({
    title: "[teste] Aviso com WhatsApp",
    body: "Fan-out por pessoa.",
    audience: { type: "role", value: "gestor" },
    channels: ["whatsapp"],
    createdBy: rh.id,
  });
  check("enviado", comWhats.ok, true);
  if (!comWhats.ok) throw new Error(comWhats.error);

  const entregasWhats = await getBroadcastDeliveries(comWhats.id);
  check("2 entregas (uma por gestor)", entregasWhats.length, 2);
  check("todas nominais", entregasWhats.every((e) => e.recipientName !== null), true);
  check("canal correto", entregasWhats.every((e) => e.channel === "whatsapp"), true);

  console.log("\n— Envio com Discord: UMA entrega, de canal (sem pessoa)");
  const comDiscord = await createAndSendBroadcast({
    title: "[teste] Aviso no Discord",
    body: "Publicação de canal, não por pessoa.",
    audience: { type: "all", value: null },
    channels: ["discord"],
    createdBy: rh.id,
  });
  check("enviado", comDiscord.ok, true);
  if (!comDiscord.ok) throw new Error(comDiscord.error);

  const entregasDiscord = await getBroadcastDeliveries(comDiscord.id);
  check("apenas 1 entrega, mesmo com 7 destinatários", entregasDiscord.length, 1);
  check("sem pessoa associada", entregasDiscord[0]?.recipientName, null);
  console.log(
    `   status da publicação no Discord: ${entregasDiscord[0]?.status}` +
      (entregasDiscord[0]?.errorMessage ? ` (${entregasDiscord[0].errorMessage})` : ""),
  );

  console.log("\n— Validação");
  const semTitulo = await createAndSendBroadcast({
    title: "   ",
    body: "corpo",
    audience: { type: "all", value: null },
    channels: [],
    createdBy: rh.id,
  });
  check("título vazio rejeitado", semTitulo.ok, false);

  const audienciaVazia = await createAndSendBroadcast({
    title: "[teste]",
    body: "corpo",
    audience: { type: "sector", value: "Setor Inexistente" },
    channels: [],
    createdBy: rh.id,
  });
  check("audiência sem ninguém rejeitada", audienciaVazia.ok, false);

  // Limpeza: remove só o que este teste criou.
  const criados = await db
    .select({ id: broadcasts.id })
    .from(broadcasts)
    .where(inArray(broadcasts.id, [soInApp.id, comWhats.id, comDiscord.id]));
  await db.delete(broadcastDeliveries).where(
    inArray(broadcastDeliveries.broadcastId, criados.map((c) => c.id)),
  );
  await db.delete(broadcasts).where(inArray(broadcasts.id, criados.map((c) => c.id)));
  await db.delete(notifications).where(eq(notifications.link, "/avisos"));

  console.log(
    `\n${failed === 0 ? "✔" : "✖"} ${passed} verificações ok, ${failed} falha(s).\n`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
