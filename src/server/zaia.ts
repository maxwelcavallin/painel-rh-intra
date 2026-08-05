import "server-only";

/**
 * Cliente da Zaia (WhatsApp).
 *
 * POST sem autenticação, payload com `telefone`. São dois webhooks distintos
 * porque são dois eventos distintos no agente da Zaia:
 *   - ZAIA_PASSWORD_RESET_WEBHOOK_URL → código de recuperação de senha
 *   - ZAIA_WEBHOOK_URL                → decisão de férias, avisos, lembretes
 *
 * Sem a env var configurada, vira no-op registrado — o fluxo do app não quebra
 * por causa de um canal externo indisponível.
 */

export type ZaiaResult =
  | { ok: true }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; skipped: false; error: string };

/** Normaliza para dígitos com DDI 55. Aceita "(41) 99999-8888", "41999998888" etc. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.startsWith("55")) return digits.length >= 12 ? digits : null;
  return `55${digits}`;
}

async function postZaia(
  url: string | undefined,
  payload: Record<string, unknown>,
  label: string,
): Promise<ZaiaResult> {
  if (!url) {
    console.warn(`[zaia] ${label}: webhook não configurado, envio ignorado.`);
    return { ok: false, skipped: true, reason: "webhook não configurado" };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
 * Envia o código de recuperação de senha.
 * O código NUNCA é logado — só trafega no corpo do POST para a Zaia.
 */
export async function sendPasswordResetCode(params: {
  phone: string;
  code: string;
  name: string;
}): Promise<ZaiaResult> {
  return postZaia(
    process.env.ZAIA_PASSWORD_RESET_WEBHOOK_URL,
    {
      telefone: params.phone,
      codigo: params.code,
      nome: params.name,
      mensagem: `Olá, ${params.name}! Seu código para redefinir a senha da Intranet RH é ${params.code}. Ele vale por 15 minutos. Se não foi você que pediu, ignore esta mensagem.`,
    },
    "password-reset",
  );
}

/** Notificação geral: decisão de férias, aviso do RH, lembrete de formulário. */
export async function sendWhatsApp(params: {
  phone: string;
  name: string;
  message: string;
}): Promise<ZaiaResult> {
  return postZaia(
    process.env.ZAIA_WEBHOOK_URL,
    {
      telefone: params.phone,
      nome: params.name,
      mensagem: params.message,
    },
    "notificacao",
  );
}
