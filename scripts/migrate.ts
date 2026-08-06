import { config } from "dotenv";

config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

/**
 * Aplica as migrations pelo driver HTTP do Neon (porta 443), e não pelo
 * `drizzle-kit migrate`, que abre conexão TCP na 5432.
 *
 * Motivo: em rede corporativa a 5432 costuma estar fechada — o `drizzle-kit
 * migrate` fica pendurado em "applying migrations..." sem erro nem timeout.
 * O HTTP é o mesmo caminho que o app usa em produção, então se o app conecta,
 * a migration conecta.
 *
 * O `drizzle-kit generate` continua sendo quem GERA o SQL (é offline).
 */
/** Tabelas que este projeto é dono. Qualquer outra coisa no banco é sinal de alerta. */
const OWN_TABLES = new Set([
  "users",
  "password_reset_codes",
  "vacation_requests",
  "notifications",
  "notification_settings",
  "broadcasts",
  "broadcast_deliveries",
  "forms",
  "form_responses",
]);

/**
 * Trava de segurança: se o banco tiver tabelas que não são deste projeto, ele
 * pertence a outra aplicação — aborta antes de escrever qualquer coisa.
 *
 * Existe porque isto já deu errado: uma migration deste projeto foi aplicada
 * por engano num banco de outro produto, que tinha `users` e `notifications`
 * próprios. O `neon-http` não tem transação, então a migration ficou aplicada
 * pela metade. Esta checagem custa uma query e evita repetir o episódio.
 */
async function assertDatabaseIsOurs(url: string) {
  const sql = neon(url);
  const rows = (await sql`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
  `) as { table_name: string }[];

  const foreign = rows
    .map((r) => r.table_name)
    .filter((t) => !OWN_TABLES.has(t));

  if (foreign.length > 0) {
    console.error(
      "\n✖ ABORTADO: este banco contém tabelas que não são deste projeto:\n" +
        foreign.map((t) => `    ${t}`).join("\n") +
        "\n\nA intranet de RH precisa de um banco só dela (ela define `users` e\n" +
        "`notifications` próprios). Confira a DATABASE_URL no .env.local.\n",
    );
    process.exit(1);
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL ausente. Preencha o .env.local.");

  console.log(`Banco alvo: ${new URL(url).host}`);

  await assertDatabaseIsOurs(url);

  const db = drizzle(neon(url));

  console.log("Aplicando migrations de ./drizzle …");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("✔ migrations aplicadas.");
}

main().catch((error) => {
  console.error("✖ falha na migration:", error);
  process.exit(1);
});
