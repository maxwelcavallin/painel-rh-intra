import "server-only";

import { randomInt } from "node:crypto";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { passwordResetCodes, users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/password";

import { isEnabled } from "./notifications";
import { normalizePhone, sendPasswordResetCode } from "./zaia";

const CODE_TTL_MINUTES = 15;
const MAX_ATTEMPTS = 5;
/** Códigos que podem ser pedidos na janela de TTL antes de travar. */
const MAX_REQUESTS_PER_WINDOW = 3;

function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * Pede um código de recuperação.
 *
 * Retorna SEMPRE o mesmo resultado, exista o e-mail ou não. Diferenciar aqui
 * transformaria a tela em um oráculo de quais e-mails estão cadastrados —
 * e o cadastro é feito pelo RH, então a lista é justamente o quadro de pessoal.
 */
export async function requestPasswordReset(rawEmail: string): Promise<void> {
  const email = rawEmail.trim().toLowerCase();
  if (!email) return;

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      phone: users.phone,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user || !user.isActive) return;

  const phone = normalizePhone(user.phone);
  if (!phone) {
    // Sem telefone não há como entregar o código. Registra sem vazar o e-mail.
    console.warn(
      `[password-reset] usuário ${user.id} sem telefone válido; envio ignorado.`,
    );
    return;
  }

  const windowStart = new Date(Date.now() - CODE_TTL_MINUTES * 60_000);
  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(passwordResetCodes)
    .where(
      and(
        eq(passwordResetCodes.userId, user.id),
        gt(passwordResetCodes.createdAt, windowStart),
      ),
    );

  if (count >= MAX_REQUESTS_PER_WINDOW) {
    console.warn(`[password-reset] rate limit atingido para ${user.id}.`);
    return;
  }

  const code = generateCode();
  const codeHash = await hashPassword(code);
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000);

  // Um código novo invalida os anteriores — só o último vale.
  await db
    .update(passwordResetCodes)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(passwordResetCodes.userId, user.id),
        isNull(passwordResetCodes.consumedAt),
      ),
    );

  await db
    .insert(passwordResetCodes)
    .values({ userId: user.id, codeHash, expiresAt });

  // Respeita a matriz de comunicações, mas NÃO passa pelo `notify()` genérico:
  // aquele cria notificação in-app, e o código de recuperação não pode ficar
  // registrado dentro do sistema — quem precisa dele nem consegue entrar.
  if (!(await isEnabled("password_reset", "whatsapp"))) {
    console.warn(
      "[password-reset] canal WhatsApp desligado para este tipo; código não enviado.",
    );
    return;
  }

  const result = await sendPasswordResetCode({
    phone,
    code,
    name: user.name.split(" ")[0],
  });

  if (!result.ok) {
    const reason = result.skipped ? result.reason : result.error;
    console.error(`[password-reset] falha ao enviar para ${user.id}: ${reason}`);
  }
}

export type ResetOutcome =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Consome o código e troca a senha.
 * Mensagem de erro é sempre genérica — não distingue código errado de e-mail
 * inexistente.
 */
export async function confirmPasswordReset(params: {
  email: string;
  code: string;
  newPassword: string;
}): Promise<ResetOutcome> {
  const invalid = { ok: false, error: "Código inválido ou expirado." } as const;

  const email = params.email.trim().toLowerCase();
  const code = params.code.replace(/\D/g, "");

  if (!email || code.length !== 6) return invalid;

  const [user] = await db
    .select({ id: users.id, isActive: users.isActive })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user || !user.isActive) return invalid;

  const [record] = await db
    .select()
    .from(passwordResetCodes)
    .where(
      and(
        eq(passwordResetCodes.userId, user.id),
        isNull(passwordResetCodes.consumedAt),
        gt(passwordResetCodes.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(passwordResetCodes.createdAt))
    .limit(1);

  if (!record) return invalid;

  if (record.attempts >= MAX_ATTEMPTS) {
    // Queima o código: força pedir um novo em vez de permitir força bruta.
    await db
      .update(passwordResetCodes)
      .set({ consumedAt: new Date() })
      .where(eq(passwordResetCodes.id, record.id));
    return {
      ok: false,
      error: "Muitas tentativas. Solicite um novo código.",
    };
  }

  // Conta a tentativa ANTES de comparar — se a request morrer no meio,
  // a tentativa já está registrada.
  await db
    .update(passwordResetCodes)
    .set({ attempts: record.attempts + 1 })
    .where(eq(passwordResetCodes.id, record.id));

  const matches = await verifyPassword(code, record.codeHash);
  if (!matches) return invalid;

  const passwordHash = await hashPassword(params.newPassword);

  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  await db
    .update(passwordResetCodes)
    .set({ consumedAt: new Date() })
    .where(eq(passwordResetCodes.userId, user.id));

  return { ok: true };
}

export const PASSWORD_MIN_LENGTH = 8;

export function validatePasswordStrength(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `A senha precisa ter ao menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }
  if (!/[a-zA-Z]/.test(password)) return "A senha precisa ter ao menos uma letra.";
  if (!/[0-9]/.test(password)) return "A senha precisa ter ao menos um número.";
  return null;
}
