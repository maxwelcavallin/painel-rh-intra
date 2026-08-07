import type { Metadata } from "next";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { rangesOverlap } from "@/lib/clt";
import { requireManagerOrRH } from "@/lib/dal";
import { listEvents } from "@/server/institutional-events";
import { listPendingForApprover } from "@/server/vacations";

import { DecisionCard, type PendingRequest } from "./decision-card";

export const metadata: Metadata = { title: "Aprovações" };

export default async function AprovacoesPage() {
  // Gestor e RH apenas. Colaborador cai em /sem-permissao antes de qualquer query.
  const approver = await requireManagerOrRH();

  // O escopo (RH vê tudo, gestor vê só a própria equipe) é aplicado na query.
  const [pending, eventos] = await Promise.all([
    listPendingForApprover(approver),
    listEvents(),
  ]);

  /**
   * O mesmo aviso que o colaborador viu ao escolher a data, agora do lado de
   * quem decide. Resolvido aqui, uma vez, e não por card: são poucos eventos e
   * poucas pendências, e uma query por linha seria N+1 à toa.
   */
  function eventosDe(request: (typeof pending)[number]): string[] {
    return eventos
      .filter(
        (e) =>
          (e.sector === null || e.sector === request.employeeSector) &&
          rangesOverlap(request.startDate, request.endDate, e.startDate, e.endDate),
      )
      .map((e) => e.title);
  }

  return (
    <Stack spacing={3} sx={{ maxWidth: 900 }}>
      <Stack spacing={0.5}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Aprovações pendentes
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {approver.role === "admin"
            ? "Você vê todas as solicitações pendentes da empresa."
            : "Você vê as solicitações da sua equipe direta."}
        </Typography>
      </Stack>

      {pending.length === 0 ? (
        <Alert severity="success">
          Nenhuma solicitação aguardando decisão.
        </Alert>
      ) : (
        pending.map((request) => (
          <DecisionCard
            key={request.id}
            request={request as PendingRequest}
            eventos={eventosDe(request)}
          />
        ))
      )}
    </Stack>
  );
}
