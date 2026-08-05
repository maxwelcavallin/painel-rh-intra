import { config } from "dotenv";

config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

/**
 * Teste de conectividade com o Neon pelo mesmo caminho que o app usa
 * (HTTP sobre 443, não TCP 5432). Diagnóstico rápido quando algo não conecta.
 *
 *   npx tsx scripts/db-check.ts
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL ausente no .env.local");

  console.log("host:", new URL(url).host);

  const sql = neon(url);
  const started = Date.now();
  const rows = await sql`select current_database() as db, version() as version`;
  console.log(`✔ conectou em ${Date.now() - started}ms`);
  console.log(rows[0]);
}

main().catch((error) => {
  console.error("✖ falhou:", error instanceof Error ? error.message : error);
  process.exit(1);
});
