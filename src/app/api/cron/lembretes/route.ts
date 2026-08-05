import { NextResponse } from "next/server";

import { sendPendingReminders } from "@/server/forms";

/**
 * Lembrete automático de formulários — disparado pelo Vercel Cron.
 *
 * Esta rota está na allowlist do proxy porque o Cron não manda cookie de
 * sessão. Ela se defende sozinha com `CRON_SECRET`:
 *
 *   - Na Vercel, o Cron envia `Authorization: Bearer $CRON_SECRET`.
 *   - Sem o segredo configurado, a rota RECUSA em vez de liberar. Um segredo
 *     ausente não pode virar porta aberta para disparar WhatsApp de graça.
 *
 * Cadência no `vercel.json`. A função é idempotente dentro da janela: cada
 * formulário só recobra depois de passar outro `reminderAfterHours`.
 *
 * PLANO HOBBY: a Vercel permite 2 crons por projeto e UMA execução por dia —
 * não existe cadência horária no gratuito. Por isso o agendamento é diário e o
 * RH tem um botão de "cobrar agora" no painel, que chama a mesma função. Quem
 * define de fato o momento da cobrança é o `reminderAfterHours` de cada
 * formulário; o cron só é a passada diária que verifica os vencidos.
 */

/** Hobby permite até 60s de execução. O fan-out de WhatsApp é sequencial. */
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.error("[cron] CRON_SECRET não configurado; requisição recusada.");
    return NextResponse.json(
      { error: "Cron não configurado." },
      { status: 503 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const report = await sendPendingReminders();
    console.log(
      `[cron] ${report.formsChecked} formulário(s) abertos, ` +
        `${report.formsOverdue} vencido(s), ${report.managersNotified} gestor(es) avisado(s).`,
    );
    return NextResponse.json(report);
  } catch (error) {
    console.error("[cron] falha ao processar lembretes:", error);
    return NextResponse.json(
      { error: "Falha ao processar lembretes." },
      { status: 500 },
    );
  }
}
