import type { Metadata } from "next";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { requireRH } from "@/lib/dal";
import { listActivePeople, listSectors } from "@/server/audience";

import { BroadcastForm } from "../broadcast-form";

export const metadata: Metadata = { title: "Novo aviso" };

export default async function NovoAvisoPage() {
  await requireRH();

  const [sectors, people] = await Promise.all([listSectors(), listActivePeople()]);

  return (
    <Stack spacing={3} sx={{ maxWidth: 900 }}>
      <Stack spacing={0.5}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Novo aviso
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Confira a audiência antes de enviar — depois de disparado não dá para
          recolher.
        </Typography>
      </Stack>

      <BroadcastForm sectors={sectors} people={people} />
    </Stack>
  );
}
