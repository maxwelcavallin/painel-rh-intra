import { HttpError, requireRoleApi } from "@/lib/dal";
import { formatBR } from "@/lib/clt";
import { formatCpf } from "@/lib/format";
import { listOperationalControl } from "@/server/vacations";

/**
 * Relatório de férias em CSV — o arquivo que o RH envia à Senior nos dias 10 e 20.
 *
 * Só RH. Contém CPF, então é a única saída do sistema onde esse dado sai por
 * extenso — e sai por download autenticado, nunca por query string ou log.
 *
 * `?pendentes=1` traz só o que ainda não foi repassado, que é o uso do dia a dia.
 */
export async function GET(request: Request) {
  try {
    await requireRoleApi("admin");

    const url = new URL(request.url);
    const somentePendentes = url.searchParams.get("pendentes") === "1";

    const rows = await listOperationalControl();
    const filtradas = somentePendentes
      ? rows.filter((r) => !r.reportedToSeniorAt)
      : rows;

    const cabecalho = [
      "Colaborador",
      "CPF",
      "Inicio",
      "Termino",
      "Dias de gozo",
      "Dias de abono",
      "Antecipa 13o",
      "Pagamento ate",
      "Pago em",
      "Recibo assinado em",
      "Repassado em",
    ];

    // Ponto e vírgula e BOM: é assim que o Excel em português abre o arquivo
    // com as colunas separadas e os acentos corretos, sem passo manual.
    const linhas = filtradas.map((r) =>
      [
        r.employeeName,
        r.employeeCpf ? formatCpf(r.employeeCpf) : "",
        formatBR(r.startDate),
        formatBR(r.endDate),
        String(r.days),
        String(r.abonoDays),
        r.advance13th ? "Sim" : "Nao",
        r.paymentDueDate ? formatBR(r.paymentDueDate) : "",
        r.paidAt ? r.paidAt.toLocaleDateString("pt-BR") : "",
        r.receiptSignedAt ? r.receiptSignedAt.toLocaleDateString("pt-BR") : "",
        r.reportedToSeniorAt ? r.reportedToSeniorAt.toLocaleDateString("pt-BR") : "",
      ]
        .map((campo) => `"${String(campo).replace(/"/g, '""')}"`)
        .join(";"),
    );

    const csv = "﻿" + [cabecalho.join(";"), ...linhas].join("\r\n");
    const hoje = new Date().toISOString().slice(0, 10);

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="ferias-${hoje}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return new Response(error.message, { status: error.status });
    }
    return new Response("Erro ao gerar o relatório.", { status: 500 });
  }
}
