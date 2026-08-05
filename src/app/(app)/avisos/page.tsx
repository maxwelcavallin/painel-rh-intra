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
import { MessageCircle, Megaphone, Plus } from "lucide-react";

import { requireRH } from "@/lib/dal";
import { describeAudience } from "@/server/audience";
import { listBroadcasts } from "@/server/broadcasts";

export const metadata: Metadata = { title: "Avisos" };

const CHANNEL_META = {
  discord: { label: "Discord", icon: Megaphone },
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
  email: { label: "E-mail", icon: MessageCircle },
} as const;

const STATUS_COLOR = {
  sent: "success",
  failed: "error",
  skipped: "warning",
  pending: "default",
} as const;

const STATUS_LABEL = {
  sent: "entregue",
  failed: "falhou",
  skipped: "ignorada",
  pending: "pendente",
} as const;

export default async function AvisosPage() {
  await requireRH();

  const broadcasts = await listBroadcasts();

  return (
    <Stack spacing={3} sx={{ maxWidth: 900 }}>
      <Stack
        direction="row"
        spacing={2}
        sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Avisos
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {broadcasts.length} aviso(s) enviado(s)
          </Typography>
        </Box>
        <Button href="/avisos/novo" variant="contained" startIcon={<Plus size={18} />}>
          Novo aviso
        </Button>
      </Stack>

      {broadcasts.length === 0 && (
        <Alert severity="info">
          Nenhum aviso enviado ainda. O histórico registra cada tentativa de
          entrega, inclusive as que falharam.
        </Alert>
      )}

      {broadcasts.map((b) => (
        <Card key={b.id}>
          <CardContent sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Stack
                direction="row"
                spacing={2}
                sx={{ justifyContent: "space-between", flexWrap: "wrap" }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 600 }}>{b.title}</Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    {b.authorName} · {b.createdAt.toLocaleString("pt-BR")}
                  </Typography>
                </Box>
                <Chip
                  label={describeAudience({
                    type: b.audienceType,
                    value: b.audienceValue,
                  })}
                  size="small"
                  variant="outlined"
                />
              </Stack>

              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                {b.body}
              </Typography>

              <Divider />

              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                {b.deliveries.length === 0 && (
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    Sem canal externo — só notificação dentro da intranet.
                  </Typography>
                )}
                {b.deliveries.map((d, i) => {
                  const meta = CHANNEL_META[d.channel];
                  const Icon = meta.icon;
                  return (
                    <Chip
                      key={i}
                      icon={<Icon size={13} />}
                      label={`${meta.label}: ${d.total} ${STATUS_LABEL[d.status]}`}
                      color={STATUS_COLOR[d.status]}
                      size="small"
                      variant={d.status === "sent" ? "filled" : "outlined"}
                    />
                  );
                })}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
