import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

type Database = ReturnType<typeof createClient>;

function createClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL não definida. Rode `vercel env pull .env.local` ou preencha o .env.local.",
    );
  }

  return drizzle(neon(connectionString), { schema });
}

let client: Database | null = null;

/**
 * Conexão preguiçosa: só é criada na primeira query, não no import.
 *
 * Importa para o build — `next build` percorre os módulos de cada rota, e uma
 * conexão criada no topo do arquivo faria o build inteiro falhar em qualquer
 * ambiente sem `DATABASE_URL` (CI, primeiro deploy na Vercel antes do banco
 * estar ligado). Assim o erro só aparece quando alguém de fato consulta o banco.
 */
export const db = new Proxy({} as Database, {
  get(_target, prop) {
    client ??= createClient();
    // `receiver = client` (não o Proxy). Se o Drizzle usar campos privados
    // (`#field`) internamente, refletir com o Proxy como receiver estoura
    // TypeError; passar o client evita isso e não muda semântica de leitura.
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export { schema };
