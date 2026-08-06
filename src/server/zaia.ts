import "server-only";

/**
 * Cliente da Zaia (WhatsApp).
 *
 * POST sem autenticação, payload com `telefone`.
 *
 * CADA TEMPLATE TEM SUA PRÓPRIA URL. Na Zaia, um webhook está amarrado a um
 * evento/template específico do agente — mandar a decisão de férias no webhook
 * de recuperação de senha entregaria a mensagem errada. Por isso cada tipo de
 * notificação tem sua env var própria, listada em `WEBHOOK_ENV`.
 *
 * Enquanto uma URL específica não estiver configurada, o envio cai em
 * `ZAIA_WEBHOOK_URL` (genérica) se ela existir; senão vira no-op registrado.
 * Assim dá para configurar os templates aos poucos sem quebrar nada.
 */

export type ZaiaTemplate =
  | "password_reset"
  | "vacation_request"
  | "vacation_decision"
  | "vacation_expiring"
  | "vacation_receipt"
  | "vacation_payment"
  | "form_new"
  | "form_reminder"
  | "broadcast";

/** Um webhook por template. Adicionar template novo = adicionar linha aqui. */
const WEBHOOK_ENV: Record<ZaiaTemplate, string[]> = {
  // O primeiro nome é o oficial; os seguintes são compatibilidade com as
  // variáveis que já existiam antes desta separação.
  password_reset: ["ZAIA_WEBHOOK_PASSWORD_RESET", "ZAIA_PASSWORD_RESET_WEBHOOK_URL"],
  vacation_request: ["ZAIA_WEBHOOK_VACATION_REQUEST"],
  vacation_decision: ["ZAIA_WEBHOOK_VACATION_DECISION"],
  vacation_expiring: ["ZAIA_WEBHOOK_VACATION_EXPIRING"],
  vacation_receipt: ["ZAIA_WEBHOOK_VACATION_RECEIPT"],
  vacation_payment: ["ZAIA_WEBHOOK_VACATION_PAYMENT"],
  form_new: ["ZAIA_WEBHOOK_FORM_NEW"],
  form_reminder: ["ZAIA_WEBHOOK_FORM_REMINDER"],
  broadcast: ["ZAIA_WEBHOOK_BROADCAST"],
};

export type ZaiaResult =
  | { ok: true }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; skipped: false; error: string };

/** Normaliza para dígitos com DDI 55. Aceita "(41) 99999-8888", "41999998888" etc. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  // Número BR sem DDI: 10 (fixo) ou 11 (celular). Com DDI 55: 12 ou 13.
  // "Começa com 55" NÃO é garantia de DDI — DDD 55 (Santa Maria/RS) também
  // começa. Distinguimos pelo comprimento total.
  if (digits.length === 12 || digits.length === 13) {
    return digits.startsWith("55") ? digits : `55${digits}`;
  }
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return null;
}

function webhookFor(template: ZaiaTemplate): string | null {
  for (const name of WEBHOOK_ENV[template]) {
    const url = process.env[name];
    if (url) return url;
  }
  // Última tentativa: a genérica, para quem ainda não separou os templates.
  return process.env.ZAIA_WEBHOOK_URL || null;
}

/**
 * Envia uma mensagem pelo webhook do template indicado.
 *
 * `extra` carrega os campos que aquele template específico espera além de
 * `telefone`/`nome`/`mensagem` — por exemplo `codigo` na recuperação de senha.
 */
export async function sendZaia(params: {
  template: ZaiaTemplate;
  phone: string;
  name: string;
  message: string;
  extra?: Record<string, string>;
}): Promise<ZaiaResult> {
  const url = webhookFor(params.template);

  if (!url) {
    console.warn(
      `[zaia] template "${params.template}" sem webhook configurado; envio ignorado.`,
    );
    return {
      ok: false,
      skipped: true,
      reason: `webhook do template "${params.template}" não configurado`,
    };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        telefone: params.phone,
        nome: params.name,
        mensagem: params.message,
        ...params.extra,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        ok: false,
        skipped: false,
        error: `HTTP ${response.status} ${body.slice(0, 200)}`,
      };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Código de recuperação de senha.
 * O código NUNCA é logado — só trafega no corpo do POST para a Zaia.
 */
export async function sendPasswordResetCode(params: {
  phone: string;
  code: string;
  name: string;
}): Promise<ZaiaResult> {
  return sendZaia({
    template: "password_reset",
    phone: params.phone,
    name: params.name,
    message:
      `Olá, ${params.name}! Seu código para redefinir a senha da Intranet RH é ` +
      `${params.code}. Ele vale por 15 minutos. Se não foi você que pediu, ignore esta mensagem.`,
    extra: { codigo: params.code },
  });
}
