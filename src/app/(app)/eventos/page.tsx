import type { Metadata } from "next";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { requireRH } from "@/lib/dal";
import { listSectors } from "@/server/audience";
import { listEvents } from "@/server/institutional-events";

import { EventsManager } from "./events-manager";

export const metadata: Metadata = { title: "Eventos institucionais" };

export default async function EventosPage() {
  // Só o RH cadastra período crítico da empresa.
  await requireRH();

  const [eventos, setores] = await Promise.all([listEvents(), listSectors()]);

  return (
    <Stack spacing={3} sx={{ maxWidth: 900 }}>
      <Stack spacing={0.5}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Eventos institucionais
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Períodos em que a empresa prefere não ter gente de férias
        </Typography>
      </Stack>

      <Alert severity="info">
        Quem pedir férias em cima de um destes períodos vê o aviso na hora de
        escolher a data, e o conflito aparece para o gestor na aprovação.{" "}
        <strong>O pedido não é bloqueado</strong> — a decisão continua sendo de
        quem aprova.
      </Alert>

      <EventsManager eventos={eventos} setores={setores} />
    </Stack>
  );
}
