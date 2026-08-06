import type { Metadata } from "next";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { Check, Download, FileSignature, Send, Wallet } from "lucide-react";

import { requireRH } from "@/lib/dal";
import { formatBR, todayISOBrazil } from "@/lib/clt";
import { listOperationalControl } from "@/server/vacations";

import {
  markReportedAction,
  registerPaymentAction,
  registerReceiptAction,
} from "./actions";

export const metadata: Metadata = { title: "Controle de férias" };

function diasAte(iso: string): number {
  const hoje = todayISOBrazil();
  const [ay, am, ad] = hoje.split("-").map(Number);
  const [by, bm, bd] = iso.split("-").map(Number);
  return Math.round(
    (Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000,
  );
}

export default async function ControlePage() {
  await requireRH();

  const rows = await listOperationalControl();

  const pagamentoAtrasado = rows.filter(
    (r) => !r.paidAt && r.paymentDueDate && diasAte(r.paymentDueDate) < 0,
  );
  const pagamentoProximo = rows.filter(
    (r) =>
      !r.paidAt &&
      r.paymentDueDate &&
      diasAte(r.paymentDueDate) >= 0 &&
      diasAte(r.paymentDueDate) <= 7,
  );
  const semRecibo = rows.filter((r) => !r.receiptSignedAt);
  const naoRepassadas = rows.filter((r) => !r.reportedToSeniorAt);

  return (
    <Stack spacing={3}>
      <Stack
        direction="row"
        spacing={2}
        sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Controle de férias
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Recibo, pagamento e repasse — onde a multa realmente acontece.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button
            href="/api/relatorios/ferias?pendentes=1"
            variant="contained"
            startIcon={<Download size={18} />}
          >
            CSV do lote pendente
          </Button>
          <Button href="/api/relatorios/ferias" startIcon={<Download size={18} />}>
            CSV completo
          </Button>
        </Stack>
      </Stack>

      {pagamentoAtrasado.length > 0 && (
        <Alert severity="error">
          <strong>{pagamentoAtrasado.length}</strong> pagamento(s) com prazo
          vencido. O art. 145 da CLT exige o pagamento até 2 dias úteis antes do
          início das férias.
        </Alert>
      )}
      {pagamentoProximo.length > 0 && (
        <Alert severity="warning">
          {pagamentoProximo.length} pagamento(s) vencem nos próximos 7 dias.
        </Alert>
      )}
      {semRecibo.length > 0 && (
        <Alert severity="info">
          {semRecibo.length} recibo(s) ainda sem assinatura registrada.
        </Alert>
      )}

      {naoRepassadas.length > 0 && (
        <Card>
          <Box sx={{ p: 2.5 }}>
            <Stack
              direction="row"
              spacing={2}
              sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}
            >
              <Typography variant="body2">
                <strong>{naoRepassadas.length}</strong> solicitação(ões) ainda não
                repassadas à Senior. Baixe o CSV e confirme o envio.
              </Typography>
              <Box component="form" action={markReportedAction}>
                <input
                  type="hidden"
                  name="ids"
                  value={naoRepassadas.map((r) => r.id).join(",")}
                />
                <Button type="submit" size="small" startIcon={<Send size={16} />}>
                  Marcar lote como repassado
                </Button>
              </Box>
            </Stack>
          </Box>
        </Card>
      )}

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Colaborador</TableCell>
                <TableCell>Período</TableCell>
                <TableCell align="right">Gozo</TableCell>
                <TableCell align="right">Abono</TableCell>
                <TableCell>13º</TableCell>
                <TableCell>Pagar até</TableCell>
                <TableCell>Recibo</TableCell>
                <TableCell>Pagamento</TableCell>
                <TableCell>Senior</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => {
                const dias = r.paymentDueDate ? diasAte(r.paymentDueDate) : null;
                const atrasado = !r.paidAt && dias !== null && dias < 0;

                return (
                  <TableRow key={r.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {r.employeeName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatBR(r.startDate)} a {formatBR(r.endDate)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{r.days}</TableCell>
                    <TableCell align="right">{r.abonoDays || "—"}</TableCell>
                    <TableCell>{r.advance13th ? "Sim" : "—"}</TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: atrasado ? 700 : 400,
                          color: atrasado ? "error.main" : "text.primary",
                        }}
                      >
                        {r.paymentDueDate ? formatBR(r.paymentDueDate) : "—"}
                      </Typography>
                      {dias !== null && !r.paidAt && (
                        <Typography variant="caption" sx={{ color: atrasado ? "error.main" : "text.secondary" }}>
                          {dias < 0 ? `${Math.abs(dias)}d atrasado` : `em ${dias}d`}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.receiptSignedAt ? (
                        <Chip
                          icon={<Check size={12} />}
                          label={r.receiptSignedAt.toLocaleDateString("pt-BR")}
                          color="success"
                          size="small"
                          variant="outlined"
                        />
                      ) : (
                        <Box component="form" action={registerReceiptAction}>
                          <input type="hidden" name="requestId" value={r.id} />
                          <Button
                            type="submit"
                            size="small"
                            startIcon={<FileSignature size={14} />}
                          >
                            Registrar
                          </Button>
                        </Box>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.paidAt ? (
                        <Chip
                          icon={<Check size={12} />}
                          label={r.paidAt.toLocaleDateString("pt-BR")}
                          color="success"
                          size="small"
                          variant="outlined"
                        />
                      ) : (
                        <Box component="form" action={registerPaymentAction}>
                          <input type="hidden" name="requestId" value={r.id} />
                          <Button
                            type="submit"
                            size="small"
                            color={atrasado ? "error" : "primary"}
                            startIcon={<Wallet size={14} />}
                          >
                            Registrar
                          </Button>
                        </Box>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.reportedToSeniorAt ? (
                        <Chip
                          label={r.reportedToSeniorAt.toLocaleDateString("pt-BR")}
                          size="small"
                          variant="outlined"
                        />
                      ) : (
                        <Chip label="Pendente" color="warning" size="small" />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {rows.length === 0 && (
        <Alert severity="info">
          Nenhuma férias aprovada ainda. Esta tela lista o que já passou pela
          dupla aprovação e precisa de recibo, pagamento e repasse.
        </Alert>
      )}
    </Stack>
  );
}
