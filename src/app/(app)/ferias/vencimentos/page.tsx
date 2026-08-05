import type { Metadata } from "next";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
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
import { AlertTriangle } from "lucide-react";

import { requireManagerOrRH } from "@/lib/dal";
import { formatBR } from "@/lib/clt";
import { listVacationStatus } from "@/server/vacation-deadlines";

export const metadata: Metadata = { title: "Vencimento de férias" };

const SEVERITY = {
  expired: { label: "Vencido", color: "error" as const },
  critical: { label: "Crítico", color: "error" as const },
  warning: { label: "Atenção", color: "warning" as const },
  ok: { label: "Em dia", color: "success" as const },
};

export default async function VencimentosPage() {
  const approver = await requireManagerOrRH();
  const isRH = approver.role === "admin";

  const todos = await listVacationStatus();

  // Gestor vê só a própria equipe — filtro aplicado sobre o resultado do
  // cálculo, que é global por natureza.
  const status = isRH
    ? todos
    : todos.filter((s) => s.managerId === approver.id);

  const urgentes = status.filter(
    (s) => s.severity === "expired" || s.severity === "critical",
  );
  const atencao = status.filter((s) => s.severity === "warning");

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Vencimento de férias
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {isRH
            ? "Toda a empresa."
            : "Sua equipe direta."}{" "}
          O prazo que importa é o de <strong>concessão</strong>: passar dele
          obriga a empresa a pagar em dobro (art. 137 da CLT).
        </Typography>
      </Stack>

      {urgentes.length > 0 ? (
        <Alert severity="error" icon={<AlertTriangle size={20} />}>
          <strong>{urgentes.length}</strong> pessoa(s) com prazo vencido ou a
          menos de 30 dias de vencer.
        </Alert>
      ) : (
        <Alert severity="success">
          Nenhum prazo de concessão vencido ou crítico
          {atencao.length > 0 && ` — ${atencao.length} em atenção`}.
        </Alert>
      )}

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Colaborador</TableCell>
                <TableCell>Setor</TableCell>
                {isRH && <TableCell>Gestor</TableCell>}
                <TableCell>Período aquisitivo</TableCell>
                <TableCell>Conceder até</TableCell>
                <TableCell align="right">Prazo</TableCell>
                <TableCell align="right">Saldo</TableCell>
                <TableCell>Situação</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {status.map((s) => {
                const meta = SEVERITY[s.severity];
                return (
                  <TableRow key={s.userId} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {s.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        Admissão {formatBR(s.admissionDate)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{s.sector ?? "—"}</Typography>
                    </TableCell>
                    {isRH && (
                      <TableCell>
                        <Typography variant="body2">
                          {s.managerName ?? "—"}
                        </Typography>
                      </TableCell>
                    )}
                    <TableCell>
                      <Typography variant="body2">
                        {formatBR(s.deadline.acquisitive.start)} a{" "}
                        {formatBR(s.deadline.acquisitive.end)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {formatBR(s.deadline.concessiveEnd)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: s.severity === "ok" ? 400 : 700,
                          color:
                            s.severity === "expired" || s.severity === "critical"
                              ? "error.main"
                              : "text.primary",
                        }}
                      >
                        {s.deadline.daysUntilDeadline < 0
                          ? `${Math.abs(s.deadline.daysUntilDeadline)}d vencido`
                          : `${s.deadline.daysUntilDeadline}d`}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">
                        {s.daysRemaining} de 30
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
                        <Chip label={meta.label} color={meta.color} size="small" />
                        {s.hasScheduled && (
                          <Chip label="Já marcou" size="small" variant="outlined" />
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Box>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          Quem está vencido ou crítico recebe aviso automático na passada diária
          — colaborador e gestor. Quem já marcou férias sai da urgência.
        </Typography>
      </Box>
    </Stack>
  );
}
