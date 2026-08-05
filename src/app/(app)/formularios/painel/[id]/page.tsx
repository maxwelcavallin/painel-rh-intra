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
import { notFound } from "next/navigation";
import { Check, Clock, Lock, Unlock } from "lucide-react";

import { requireManagerOrRH } from "@/lib/dal";
import { getResponses, getScoreboard } from "@/server/forms";

import { toggleFormAction } from "../../actions";

export const metadata: Metadata = { title: "Quem respondeu" };

export default async function PlacarFormularioPage({
  params,
}: PageProps<"/formularios/painel/[id]">) {
  const approver = await requireManagerOrRH();
  const { id } = await params;

  const isRH = approver.role === "admin";

  // Gestor recebe o placar já filtrado pela própria equipe — o escopo é aplicado
  // na consulta, não escondendo linhas na renderização.
  const board = await getScoreboard(id, isRH ? null : approver.id);
  if (!board) notFound();

  const responses = isRH ? await getResponses(id) : [];
  const total = board.responded.length + board.missing.length;

  return (
    <Stack spacing={3} sx={{ maxWidth: 860 }}>
      <Stack
        direction="row"
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            {board.form.title}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {board.responded.length} de {total} responderam
            {!isRH && " na sua equipe"}
          </Typography>
        </Box>

        {isRH && (
          <Box component="form" action={toggleFormAction}>
            <input type="hidden" name="formId" value={board.form.id} />
            <input
              type="hidden"
              name="close"
              value={board.form.closedAt ? "0" : "1"}
            />
            <Button
              type="submit"
              startIcon={
                board.form.closedAt ? <Unlock size={16} /> : <Lock size={16} />
              }
            >
              {board.form.closedAt ? "Reabrir" : "Encerrar"}
            </Button>
          </Box>
        )}
      </Stack>

      {total === 0 && (
        <Alert severity="info">
          Este formulário não atinge ninguém da sua equipe.
        </Alert>
      )}

      {board.missing.length > 0 && (
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Clock size={18} />
                <Typography sx={{ fontWeight: 600 }}>
                  Faltam responder ({board.missing.length})
                </Typography>
              </Stack>
              <Divider />
              <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
                {board.missing.map((p) => (
                  <Chip key={p.id} label={p.name} color="warning" variant="outlined" />
                ))}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}

      {board.responded.length > 0 && (
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Check size={18} />
                <Typography sx={{ fontWeight: 600 }}>
                  Já responderam ({board.responded.length})
                </Typography>
              </Stack>
              <Divider />
              <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
                {board.responded.map((p) => (
                  <Chip
                    key={p.id}
                    label={`${p.name} · ${p.respondedAt.toLocaleDateString("pt-BR")}`}
                    color="success"
                    variant="outlined"
                  />
                ))}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}

      {isRH && responses.length > 0 && (
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Typography sx={{ fontWeight: 600 }}>Respostas</Typography>
              <Divider />
              {responses.map((r) => (
                <Box key={r.userId}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {r.name}
                  </Typography>
                  <Stack spacing={0.5} sx={{ mt: 0.5, pl: 1 }}>
                    {board.form.questions.map((q) => {
                      const answer = (r.answers as Record<string, unknown>)[q.id];
                      const text = Array.isArray(answer)
                        ? answer.join(", ")
                        : String(answer ?? "—");
                      return (
                        <Typography key={q.id} variant="body2">
                          <Box component="span" sx={{ color: "text.secondary" }}>
                            {q.label}:
                          </Box>{" "}
                          {text || "—"}
                        </Typography>
                      );
                    })}
                  </Stack>
                  <Divider sx={{ mt: 1.5 }} />
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
