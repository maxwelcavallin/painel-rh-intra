import type { Metadata } from "next";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { CalendarPlus, Sparkles } from "lucide-react";

import { StatusChip } from "@/components/status-chip";
import { requireSession } from "@/lib/dal";
import { formatBR } from "@/server/facts";
import { listMyRequests } from "@/server/vacations";

export const metadata: Metadata = { title: "Minhas férias" };

/**
 * `reject` não credita a IA de propósito: bloqueio legal é imposto em código
 * (ver `clamp` em `server/agent.ts`), a IA só redige a explicação. Dizer "a IA
 * reprovou" seria impreciso e daria margem a pedir revisão do modelo.
 */
const AI_LABEL = {
  approve: "IA recomendou aprovar",
  reject: "Reprovado automaticamente · impedimento legal",
  review: "IA pediu análise humana",
} as const;

export default async function MinhasFeriasPage() {
  const user = await requireSession();
  const requests = await listMyRequests(user.id);

  return (
    <Stack spacing={3} sx={{ maxWidth: 900 }}>
      <Stack
        direction="row"
        spacing={2}
        sx={{ alignItems: "center", justifyContent: "space-between" }}
      >
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Minhas solicitações
        </Typography>
        <Button
          href="/ferias/solicitar"
          variant="contained"
          startIcon={<CalendarPlus size={18} />}
        >
          Nova solicitação
        </Button>
      </Stack>

      {requests.length === 0 && (
        <Alert severity="info">
          Você ainda não solicitou férias. Use o botão acima para começar.
        </Alert>
      )}

      {requests.map((request) => (
        <Card key={request.id}>
          <CardContent sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Stack
                direction="row"
                spacing={2}
                sx={{
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 600 }}>
                    {formatBR(request.startDate)} a {formatBR(request.endDate)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    {request.days} dia(s) corridos · enviada em{" "}
                    {request.createdAt.toLocaleDateString("pt-BR")}
                  </Typography>
                </Box>
                <StatusChip status={request.status} />
              </Stack>

              {request.aiRecommendation && (
                <>
                  <Divider />
                  <Stack spacing={1}>
                    <Chip
                      icon={<Sparkles size={14} />}
                      label={AI_LABEL[request.aiRecommendation]}
                      size="small"
                      color="info"
                      variant="outlined"
                      sx={{ alignSelf: "flex-start" }}
                    />
                    <Typography variant="body2">{request.aiReasoning}</Typography>
                  </Stack>
                </>
              )}

              {(request.rhNote || request.managerNote) && (
                <>
                  <Divider />
                  <Stack spacing={0.5}>
                    {request.rhNote && (
                      <Typography variant="body2">
                        <strong>RH:</strong> {request.rhNote}
                      </Typography>
                    )}
                    {request.managerNote && (
                      <Typography variant="body2">
                        <strong>Gestor:</strong> {request.managerNote}
                      </Typography>
                    )}
                  </Stack>
                </>
              )}
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
