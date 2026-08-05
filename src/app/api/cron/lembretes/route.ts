import { NextResponse } from "next/server";

import { sendPendingReminders } from "@/server/forms";
import { notifyExpiringVacations } from "@/server/vacation-deadlines";
import { notifyPaymentDeadlines } from "@/server/vacation-alerts";

/**
 * Passada diária — disparada pelo Vercel Cron.
 *
 * Faz três coisas, na ordem de risco:
 *   1. Férias com período concessivo vencendo (art. 137 — pagamento em dobro).
 *   2. Pagamento e recibo a vencer (art. 145 — a multa mora aqui).
 *   3. Formulários pendentes de resposta.
 *
 * Está na allowlist do proxy porque o Cron não manda cookie; defende-se com
 * `CRON_SECRET`. Sem o segredo configurado, RECUSA em vez de liberar — segredo
 * ausente não pode virar porta aberta para disparar mensagem de graça.
 *
 * PLANO HOBBY: a Vercel permite 2 crons e UMA execução por dia. Por isso tudo
 * roda na mesma passada, e o RH tem botões de disparo manual nas telas.
 */

/** Hobby permite até 60s. Os envios são sequenciais. */
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.error("[cron] CRON_SECRET não configurado; requisição recusada.");
    return NextResponse.json({ error: "Cron não configurado." }, { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    // `allSettled`: uma rotina que falha não pode impedir as outras de rodar.
    const [vencimentos, pagamentos, formularios] = await Promise.allSettled([
      notifyExpiringVacations(),
      notifyPaymentDeadlines(),
      sendPendingReminders(),
    ]);

    const unwrap = <T,>(r: PromiseSettledResult<T>) =>
      r.status === "fulfilled" ? r.value : { erro: String(r.reason).slice(0, 300) };

    const report = {
      vencimentoDeFerias: unwrap(vencimentos),
      pagamentoERecibo: unwrap(pagamentos),
      formularios: unwrap(formularios),
    };

    console.log("[cron] passada diária concluída:", JSON.stringify(report));
    return NextResponse.json(report);
  } catch (error) {
    console.error("[cron] falha inesperada:", error);
    return NextResponse.json({ error: "Falha ao processar." }, { status: 500 });
  }
}
