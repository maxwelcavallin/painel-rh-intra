import "server-only";

/**
 * Discord via webhook — publica num canal fixo. Usado nos AVISOS GERAIS do RH
 * (Fase 3). O webhook é amarrado ao canal no momento da criação e não aceita
 * destinatário, então ele nunca serve para mensagem privada.
 *
 * ROADMAP (pós-entrega): DM para o gestor exigiria um bot com token próprio,
 * presente no mesmo servidor, e o ID numérico de cada pessoa — a API do Discord
 * não resolve `@handle`. O campo `users.discordUserId` já está no schema para
 * quando isso for retomado. Até lá o gestor é avisado por WhatsApp e in-app.
 *
 * Sem a env var, vira no-op registrado: canal externo indisponível não pode
 * derrubar uma operação que já foi gravada.
 */

export type DiscordResult =
  | { ok: true }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; skipped: false; error: string };

/**
 * Mensagem privada — o canal existe na matriz de comunicações, mas ainda não
 * entrega. Webhook não faz DM: seria preciso um bot com token próprio, no mesmo
 * servidor das pessoas, e o ID numérico de cada uma (`users.discordUserId`).
 *
 * Devolve `skipped` com o motivo em vez de fingir sucesso, para o RH ver na
 * tela por que a mensagem não saiu.
 */
export async function sendDiscordDirect(params: {
  discordUserId: string | null;
  title: string;
  body: string;
}): Promise<DiscordResult> {
  if (!process.env.DISCORD_BOT_TOKEN) {
    return {
      ok: false,
      skipped: true,
      reason: "DM no Discord exige bot — está no roadmap pós-entrega",
    };
  }
  if (!params.discordUserId) {
    return {
      ok: false,
      skipped: true,
      reason: "colaborador sem ID numérico do Discord no cadastro",
    };
  }
  // Quando o bot existir, a implementação entra aqui (abrir DM + postar).
  return {
    ok: false,
    skipped: true,
    reason: "envio de DM ainda não implementado",
  };
}

export async function sendDiscordWebhook(params: {
  title: string;
  body: string;
  /** Cor da barra do embed. Padrão: primary.main da marca. */
  color?: number;
}): Promise<DiscordResult> {
  const url = process.env.DISCORD_WEBHOOK_URL;

  if (!url) {
    console.warn("[discord] webhook não configurado, envio ignorado.");
    return { ok: false, skipped: true, reason: "webhook não configurado" };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: params.title,
            description: params.body.slice(0, 4000),
            color: params.color ?? 0x2c5f8a,
            footer: { text: "Intranet RH · 01 Tecnologia" },
            timestamp: new Date().toISOString(),
          },
        ],
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return {
        ok: false,
        skipped: false,
        error: `HTTP ${response.status} ${text.slice(0, 200)}`,
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
