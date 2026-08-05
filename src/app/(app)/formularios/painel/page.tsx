import type { Metadata } from "next";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { BellRing, Plus } from "lucide-react";

import { requireManagerOrRH } from "@/lib/dal";
import { listFormsForDashboard } from "@/server/forms";

import { runRemindersNowAction } from "../actions";

export const metadata: Metadata = { title: "Painel de formulários" };

export default async function PainelFormulariosPage({
  searchParams,
}: PageProps<"/formularios/painel">) {
  // Gestor e RH. O escopo por equipe é aplicado dentro da consulta.
  const approver = await requireManagerOrRH();
  const params = await searchParams;

  const forms = await listFormsForDashboard(approver);
  const isRH = approver.role === "admin";

  return (
    <Stack spacing={3} sx={{ maxWidth: 900 }}>
      <Stack
        direction="row"
        spacing={2}
        sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Painel de formulários
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {isRH
              ? "Você vê todos os formulários da empresa."
              : "Você vê o placar da sua equipe direta."}
          </Typography>
        </Box>

        {isRH && (
          <Stack direction="row" spacing={1.5}>
            <Box component="form" action={runRemindersNowAction}>
              <Button type="submit" startIcon={<BellRing size={18} />}>
                Cobrar pendentes agora
              </Button>
            </Box>
            <Button
              href="/formularios/novo"
              variant="contained"
              startIcon={<Plus size={18} />}
            >
              Novo formulário
            </Button>
          </Stack>
        )}
      </Stack>

      {params.criado === "1" && (
        <Alert severity="success">
          Formulário publicado. Todo mundo da audiência já recebeu a notificação.
        </Alert>
      )}

      {isRH && (
        <Alert severity="info">
          A cobrança automática roda uma vez por dia (limite do plano gratuito da
          Vercel). O botão acima dispara a mesma rotina na hora, respeitando o
          prazo configurado em cada formulário.
        </Alert>
      )}

      {forms.length === 0 && (
        <Alert severity="info">
          Nenhum formulário atinge {isRH ? "a empresa" : "sua equipe"} no momento.
        </Alert>
      )}

      {forms.map((f) => {
        const pct = f.total === 0 ? 0 : Math.round((f.responded / f.total) * 100);
        const completo = f.missing === 0;

        return (
          <Card key={f.id}>
            <CardContent sx={{ p: 3 }}>
              <Stack spacing={2}>
                <Stack
                  direction="row"
                  spacing={2}
                  sx={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}
                >
                  <Box>
                    <Typography sx={{ fontWeight: 600 }}>{f.title}</Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      Publicado em {f.createdAt.toLocaleDateString("pt-BR")}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1}>
                    {f.closedAt && (
                      <Chip label="Encerrado" size="small" variant="outlined" />
                    )}
                    <Chip
                      label={completo ? "Todos responderam" : `${f.missing} faltando`}
                      color={completo ? "success" : "warning"}
                      size="small"
                    />
                  </Stack>
                </Stack>

                <Box>
                  <Stack
                    direction="row"
                    sx={{ justifyContent: "space-between", mb: 0.5 }}
                  >
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      {f.responded} de {f.total} responderam
                    </Typography>
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      {pct}%
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={pct}
                    color={completo ? "success" : "warning"}
                    sx={{ height: 8, borderRadius: 1 }}
                  />
                </Box>

                <Box>
                  <Button href={`/formularios/painel/${f.id}`} size="small">
                    Ver quem falta
                  </Button>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        );
      })}
    </Stack>
  );
}
