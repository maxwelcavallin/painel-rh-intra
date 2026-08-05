import { config } from "dotenv";

config({ path: ".env.local" });

import { and, eq, inArray, ne } from "drizzle-orm";

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
  /**
   * O esperado vem do banco, não de número fixo.
   *
   * Este banco hospeda o seed de demonstração E a equipe real da 01 Tec, que
   * entra e sai conforme quem está testando. O que a regra promete é o
   * CRITÉRIO — "todo mundo do setor X" — e é isso que se verifica aqui.
   */
  const ativos = await db
    .select({
      id: users.id,
      name: users.name,
      sector: users.sector,
      role: users.role,
      isCuritibaMetro: users.isCuritibaMetro,
    })
    .from(users)
    .where(and(eq(users.isActive, true), ne(users.employmentStatus, "desligado")));

  const todos = await resolveAudience({ type: "all", value: null });
  check("todos os ativos", todos.length, ativos.length);

  const tecnologia = await resolveAudience({ type: "sector", value: "Tecnologia" });
  check(
    "setor Tecnologia",
    tecnologia.length,
    ativos.filter((u) => u.sector === "Tecnologia").length,
  );
  check(
    "só gente de Tecnologia entrou",
    tecnologia.every((t) => ativos.find((u) => u.id === t.id)?.sector === "Tecnologia"),
    true,
  );

  const gestores = await resolveAudience({ type: "role", value: "gestor" });
  check("papel gestor", gestores.length, ativos.filter((u) => u.role === "gestor").length);
  check(
    "nenhum colaborador entrou como gestor",
    gestores.every((g) => ativos.find((u) => u.id === g.id)?.role === "gestor"),
    true,
  );

  const rmc = await resolveAudience({ type: "location", value: "rmc" });
  const foraRmc = await resolveAudience({ type: "location", value: "fora_rmc" });
  check("dentro da RMC", rmc.length, ativos.filter((u) => u.isCuritibaMetro).length);
  check("fora da RMC", foraRmc.length, ativos.filter((u) => !u.isCuritibaMetro).length);
  check("as duas metades somam o total", rmc.length + foraRmc.length, ativos.length);
  check(
    "ninguém aparece nas duas",
    rmc.some((r) => foraRmc.some((f) => f.id === r.id)),
    false,
  );

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
  check("um destinatário por pessoa do setor", soInApp.recipients, tecnologia.length);

  const depois = await db.select({ id: notifications.id }).from(notifications);
  check(
    "uma notificação in-app por destinatário",
    depois.length - antes.length,
    tecnologia.length,
  );

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
  check("uma entrega por gestor", entregasWhats.length, gestores.length);
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
