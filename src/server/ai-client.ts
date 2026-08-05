import "server-only";

import Anthropic from "@anthropic-ai/sdk";

/**
 * Cliente único de IA, com dois caminhos e uma ordem de preferência.
 *
 * 1. AI GATEWAY DA VERCEL (`AI_GATEWAY_API_KEY`) — endpoint compatível com a
 *    API da OpenAI, então basta um `fetch`; não entra dependência nova. Roteia
 *    para vários provedores e a cobrança fica junto da conta da Vercel.
 * 2. ANTHROPIC DIRETO (`ANTHROPIC_API_KEY`) — o caminho que já estava no ar.
 *
 * A ordem importa: a chave do Gateway é criada no painel da Vercel e não dá
 * para provisionar por código. Enquanto ela não existir, o sistema continua
 * usando a Anthropic em vez de quebrar. Quando ela aparecer, a troca é
 * automática, sem deploy.
 *
 * Quem chama trata `null` como "modelo indisponível" e cai no próprio caminho
 * determinístico — nenhuma tela pode depender de a IA estar de pé.
 */

/** Modelo no Gateway. Trocar por env sem precisar de deploy. */
const GATEWAY_MODEL = process.env.AI_GATEWAY_MODEL || "anthropic/claude-sonnet-4.5";
const ANTHROPIC_MODEL = "claude-opus-5";

const GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/chat/completions";

export type AiSource = "gateway" | "anthropic" | null;

export type AiAnswer = {
  /** JSON cru devolvido pelo modelo. Quem chama valida o formato. */
  text: string;
  source: Exclude<AiSource, null>;
};

/**
 * Pede uma resposta em JSON. Devolve `null` se nenhum caminho estiver de pé —
 * lançar aqui obrigaria cada tela a ter try/catch para algo que é opcional.
 */
export async function askForJson(params: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<AiAnswer | null> {
  const maxTokens = params.maxTokens ?? 2000;

  const gatewayKey = process.env.AI_GATEWAY_API_KEY;
  if (gatewayKey) {
    try {
      const response = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gatewayKey}`,
        },
        body: JSON.stringify({
          model: GATEWAY_MODEL,
          max_tokens: maxTokens,
          // Formato JSON pedido no protocolo, não só no prompt: o modelo passa
          // a ser obrigado a devolver objeto válido.
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: params.system },
            { role: "user", content: params.user },
          ],
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        const corpo = await response.text().catch(() => "");
        throw new Error(`HTTP ${response.status} ${corpo.slice(0, 200)}`);
      }

      const data = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const texto = data.choices?.[0]?.message?.content;
      if (texto) return { text: texto, source: "gateway" };

      throw new Error("resposta do Gateway sem conteúdo");
    } catch (error) {
      // Não desiste: cai para a Anthropic. O Gateway ser novo no projeto é
      // exatamente o motivo de existir um segundo caminho.
      console.error(
        "[ai] Gateway da Vercel falhou, tentando Anthropic:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  if (!process.env.ANTHROPIC_API_KEY) return null;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      system: params.system,
      messages: [{ role: "user", content: params.user }],
    });

    const bloco = message.content.find((c) => c.type === "text");
    if (bloco && bloco.type === "text") {
      return { text: bloco.text, source: "anthropic" };
    }
    return null;
  } catch (error) {
    console.error(
      "[ai] Anthropic falhou:",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

/**
 * Extrai o objeto JSON de uma resposta.
 *
 * Modelos às vezes embrulham o JSON em cerca de markdown mesmo com o formato
 * pedido no protocolo. Recortar entre a primeira chave e a última é mais
 * confiável que confiar na obediência ao prompt.
 */
export function parseJsonLoose<T>(texto: string): T | null {
  const inicio = texto.indexOf("{");
  const fim = texto.lastIndexOf("}");
  if (inicio === -1 || fim <= inicio) return null;
  try {
    return JSON.parse(texto.slice(inicio, fim + 1)) as T;
  } catch {
    return null;
  }
}
