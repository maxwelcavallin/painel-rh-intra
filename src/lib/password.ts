import "server-only";

import bcrypt from "bcryptjs";

const ROUNDS = 12;

/** Hash gerado uma vez, no boot, só para gastar tempo quando o usuário não existe. */
const DUMMY_HASH = bcrypt.hashSync("__usuario_inexistente__", ROUNDS);

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

/**
 * Compara sempre contra *algum* hash, mesmo quando não há usuário.
 * Sem isso, "e-mail não existe" responde muito mais rápido que "senha errada"
 * e vira um oráculo de quais e-mails estão cadastrados.
 */
export async function verifyPassword(
  plain: string,
  hash: string | null,
): Promise<boolean> {
  const result = await bcrypt.compare(plain, hash ?? DUMMY_HASH);
  return hash === null ? false : result;
}
