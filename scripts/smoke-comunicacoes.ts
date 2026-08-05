import { config } from "dotenv";

config({ path: ".env.local" });

import { and, eq } from "drizzle-orm";

import { db } from "../src/db";
import { notificationSettings, notifications, users } from "../src/db/schema";
import {
  CHANNEL_META,
  CONFIGURABLE_CHANNELS,
  getSettingsMatrix,
  isEnabled,
  NOTIFICATION_CATALOG,
  notify,
  setChannelEnabled,
} from "../src/server/notifications";

/**
 * Smoke test da central de comunicações — a matriz que o RH liga e desliga.
 *
 *   npm run test:comunicacoes
 *
 * O que importa aqui é o contrato que a tela promete: desligar um canal cala
 * aquele canal e só ele, e a notificação DENTRO da intranet nunca depende da
 * matriz (senão desligar o WhatsApp apagaria o sino também).
 *
 * DESTRUTIVO: mexe na matriz e apaga notificações do usuário de teste.
 * Restaura o estado original da matriz no fim.
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
  const [bruno] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "bruno.rocha@01tecnologia.demo"))
    .limit(1);
  if (!rh || !bruno) throw new Error("Seed ausente. Rode npm run db:seed.");

  const original = await getSettingsMatrix();

  console.log("\n— O catálogo cobre a matriz inteira");
  check("8 tipos de comunicação", NOTIFICATION_CATALOG.length, 8);
  check("3 canais configuráveis", CONFIGURABLE_CHANNELS.length, 3);
  check(
    "todo tipo tem rótulo, descrição e audiência",
    NOTIFICATION_CATALOG.every((t) => t.label && t.description && t.audience),
    true,
  );
  check(
    "todo tipo tem template da Zaia",
    NOTIFICATION_CATALOG.every((t) => Boolean(t.zaiaTemplate)),
    true,
  );
  check(
    "não há tipo duplicado",
    new Set(NOTIFICATION_CATALOG.map((t) => t.type)).size,
    NOTIFICATION_CATALOG.length,
  );
  check(
    "a matriz tem uma linha por tipo × canal",
    Object.keys(original).length,
    NOTIFICATION_CATALOG.length * CONFIGURABLE_CHANNELS.length,
  );

  console.log("\n— Só o WhatsApp entrega nesta versão");
  check("WhatsApp disponível", CHANNEL_META.whatsapp.available, true);
  check("Discord ainda não", CHANNEL_META.discord.available, false);
  check("E-mail ainda não", CHANNEL_META.email.available, false);

  console.log("\n— Ligar e desligar persiste");
  check("WhatsApp de decisão vem ligado do seed", await isEnabled("vacation_decision", "whatsapp"), true);

  await setChannelEnabled({
    type: "vacation_decision",
    channel: "whatsapp",
    enabled: false,
    updatedBy: rh.id,
  });
  check("desligou", await isEnabled("vacation_decision", "whatsapp"), false);

  const [linha] = await db
    .select()
    .from(notificationSettings)
    .where(
      and(
        eq(notificationSettings.type, "vacation_decision"),
        eq(notificationSettings.channel, "whatsapp"),
      ),
    );
  check("registra quem mexeu", linha.updatedBy, rh.id);

  console.log("\n— Desligar um canal não respinga nos outros");
  check("outro tipo intacto", await isEnabled("vacation_expiring", "whatsapp"), true);
  check("outro canal do mesmo tipo intacto", await isEnabled("vacation_decision", "discord"), false);

  console.log("\n— Não duplica linha ao alternar (upsert por tipo+canal)");
  const antes = Object.keys(await getSettingsMatrix()).length;
  await setChannelEnabled({
    type: "vacation_decision",
    channel: "whatsapp",
    enabled: true,
    updatedBy: rh.id,
  });
  await setChannelEnabled({
    type: "vacation_decision",
    channel: "whatsapp",
    enabled: false,
    updatedBy: rh.id,
  });
  check("mesmo número de linhas", Object.keys(await getSettingsMatrix()).length, antes);
  check("valeu o último valor", await isEnabled("vacation_decision", "whatsapp"), false);

  console.log("\n— A notificação da intranet ignora a matriz");
  // Com TODOS os canais externos desligados, o sino ainda tem de tocar.
  for (const canal of CONFIGURABLE_CHANNELS) {
    await setChannelEnabled({
      type: "vacation_decision",
      channel: canal,
      enabled: false,
      updatedBy: rh.id,
    });
  }
  await db.delete(notifications).where(eq(notifications.userId, bruno.id));

  const mudo = await notify({
    type: "vacation_decision",
    userId: bruno.id,
    title: "Teste com tudo desligado",
    message: "Se isto não aparecer no sino, a matriz está mandando demais.",
    link: "/ferias/minhas",
  });
  check("gravou na intranet", mudo.inApp, true);
  check("nenhum canal externo saiu", mudo.channels.filter((c) => c.status === "sent").length, 0);

  const doSino = await db
    .select({ title: notifications.title })
    .from(notifications)
    .where(eq(notifications.userId, bruno.id));
  check("uma notificação no sino", doSino.length, 1);
  check("com o título certo", doSino[0].title, "Teste com tudo desligado");

  console.log("\n— Com o WhatsApp ligado, o canal é tentado");
  await setChannelEnabled({
    type: "vacation_decision",
    channel: "whatsapp",
    enabled: true,
    updatedBy: rh.id,
  });
  await db.delete(notifications).where(eq(notifications.userId, bruno.id));

  const ligado = await notify({
    type: "vacation_decision",
    userId: bruno.id,
    title: "Teste com WhatsApp ligado",
    message: "O telefone do seed é fictício; não sair de verdade é o esperado.",
  });
  check("sino continua tocando", ligado.inApp, true);

  // A matriz decide se o canal é CONSIDERADO. O que acontece depois — enviado,
  // pulado por falta de webhook, falhado na Zaia — é outra camada, e o teste
  // não pode depender de quais webhooks já foram cadastrados no ambiente.
  const whatsapp = ligado.channels.find((c) => c.channel === "whatsapp");
  check("o WhatsApp entrou na lista de canais", Boolean(whatsapp), true);
  check(
    "com desfecho registrado, nunca silencioso",
    ["sent", "failed", "skipped"].includes(whatsapp!.status),
    true,
  );
  check(
    "canal desligado nem aparece",
    ligado.channels.some((c) => c.channel !== "whatsapp"),
    false,
  );

  console.log("\n— Falha de canal externo não derruba a operação");
  // `notify` não lança: férias aprovada continua aprovada mesmo com a Zaia fora.
  check("retornou em vez de lançar", typeof ligado, "object");
  check("e gravou o sino mesmo assim", ligado.inApp, true);

  console.log("\n— Restaurando a matriz");
  for (const [chave, valor] of Object.entries(original)) {
    const [tipo, canal] = chave.split(":");
    await setChannelEnabled({
      type: tipo as never,
      channel: canal as never,
      enabled: valor,
      updatedBy: rh.id,
    });
  }
  // Ordenado: a matriz é um mapa, e a ordem das chaves não faz parte do valor.
  const ordenada = (m: Record<string, boolean>) =>
    Object.entries(m).sort(([a], [b]) => a.localeCompare(b));
  check(
    "matriz de volta ao estado original",
    ordenada(await getSettingsMatrix()),
    ordenada(original),
  );
  await db.delete(notifications).where(eq(notifications.userId, bruno.id));

  console.log(
    `\n${failed === 0 ? "✔" : "✖"} ${passed} verificações ok, ${failed} falha(s).\n`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
