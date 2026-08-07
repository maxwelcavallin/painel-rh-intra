"use client";

import { useActionState, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { CalendarClock, Check, Sparkles, TriangleAlert, X } from "lucide-react";

import { decideVacationAction, type DecideState } from "../ferias/actions";

export type PendingRequest = {
  id: string;
  employeeName: string;
  employeeSector: string | null;
  startDate: string;
  endDate: string;
  days: number;
  notes: string | null;
  aiRecommendation: "approve" | "reject" | "review" | null;
  aiReasoning: string | null;
  aiConflicts: string[] | null;
  aiWarnings: string[] | null;
  rhApproval: "pending" | "approved" | "rejected";
  managerApproval: "pending" | "approved" | "rejected";
};

const AI_CHIP = {
  approve: { label: "IA recomenda aprovar", color: "success" as const },
  reject: { label: "IA reprovou (impedimento legal)", color: "error" as const },
  review: { label: "IA pediu análise humana", color: "warning" as const },
};

function formatBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function DecisionCard({
  request,
  eventos,
}: {
  request: PendingRequest;
  /** Eventos institucionais que cruzam este período. Vazio na maioria das vezes. */
  eventos: string[];
}) {
  const [state, action, pending] = useActionState<DecideState, FormData>(
    decideVacationAction,
    {},
  );
  const [note, setNote] = useState("");

  if (state.ok) {
    return (
      <Alert severity="success">
        Decisão registrada para {request.employeeName}.
      </Alert>
    );
  }

  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Stack
            direction="row"
            spacing={2}
            sx={{
              alignItems: "flex-start",
              justifyContent: "space-between",
              flexWrap: "wrap",
            }}
          >
            <Box>
              <Typography sx={{ fontWeight: 600 }}>
                {request.employeeName}
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {request.employeeSector ?? "Setor não informado"}
              </Typography>
            </Box>
            <Box sx={{ textAlign: "right" }}>
              <Typography sx={{ fontWeight: 600 }}>
                {formatBR(request.startDate)} a {formatBR(request.endDate)}
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {request.days} dia(s) corridos
              </Typography>
            </Box>
          </Stack>

          {request.notes && (
            <Typography variant="body2" sx={{ fontStyle: "italic" }}>
              &ldquo;{request.notes}&rdquo;
            </Typography>
          )}

          <Divider />

          {request.aiRecommendation && (
            <Stack spacing={1}>
              <Chip
                icon={<Sparkles size={14} />}
                label={AI_CHIP[request.aiRecommendation].label}
                color={AI_CHIP[request.aiRecommendation].color}
                size="small"
                variant="outlined"
                sx={{ alignSelf: "flex-start" }}
              />
              <Typography variant="body2">{request.aiReasoning}</Typography>
            </Stack>
          )}

          {request.aiConflicts && request.aiConflicts.length > 0 && (
            <Alert severity="error" icon={<TriangleAlert size={18} />}>
              <Stack spacing={0.5}>
                {request.aiConflicts.map((c, i) => (
                  <Typography key={i} variant="body2">
                    {c}
                  </Typography>
                ))}
              </Stack>
            </Alert>
          )}

          {eventos.length > 0 && (
            <Alert severity="warning" icon={<CalendarClock size={18} />}>
              <Typography variant="body2">
                Cai em {eventos.length === 1 ? "evento" : "eventos"} da empresa:{" "}
                <strong>{eventos.join(", ")}</strong>.
              </Typography>
              <Typography variant="caption" sx={{ display: "block", mt: 0.5 }}>
                Cadastrado pelo RH como período crítico. Não impede aprovar — é
                contexto para a decisão.
              </Typography>
            </Alert>
          )}

          {request.aiWarnings && request.aiWarnings.length > 0 && (
            <Alert severity="warning">
              <Stack spacing={0.5}>
                {request.aiWarnings.map((w, i) => (
                  <Typography key={i} variant="body2">
                    {w}
                  </Typography>
                ))}
              </Stack>
            </Alert>
          )}

          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
            <Chip
              label={`RH: ${request.rhApproval}`}
              size="small"
              variant="outlined"
            />
            <Chip
              label={`Gestor: ${request.managerApproval}`}
              size="small"
              variant="outlined"
            />
          </Stack>

          {state.error && <Alert severity="error">{state.error}</Alert>}

          <Divider />

          <TextField
            label="Observação (opcional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            size="small"
            fullWidth
            multiline
            minRows={2}
            disabled={pending}
          />

          <Stack direction="row" spacing={1.5}>
            {/* Dois forms independentes: cada botão envia sua própria decisão. */}
            <Box component="form" action={action}>
              <input type="hidden" name="requestId" value={request.id} />
              <input type="hidden" name="decision" value="approved" />
              <input type="hidden" name="note" value={note} />
              <Button
                type="submit"
                variant="contained"
                color="success"
                disabled={pending}
                startIcon={<Check size={18} />}
              >
                Aprovar
              </Button>
            </Box>

            <Box component="form" action={action}>
              <input type="hidden" name="requestId" value={request.id} />
              <input type="hidden" name="decision" value="rejected" />
              <input type="hidden" name="note" value={note} />
              <Button
                type="submit"
                variant="outlined"
                color="error"
                disabled={pending}
                startIcon={<X size={18} />}
              >
                Reprovar
              </Button>
            </Box>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
