import type { Metadata } from "next";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { requireRH } from "@/lib/dal";
import { listActivePeople, listSectors } from "@/server/audience";

import { FormBuilder } from "./form-builder";

export const metadata: Metadata = { title: "Novo formulário" };

export default async function NovoFormularioPage() {
  await requireRH();

  const [sectors, people] = await Promise.all([listSectors(), listActivePeople()]);

  return (
    <Stack spacing={3} sx={{ maxWidth: 900 }}>
      <Stack spacing={0.5}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Novo formulário
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Quem não responder no prazo entra na cobrança que vai para o gestor.
        </Typography>
      </Stack>

      <FormBuilder sectors={sectors} people={people} />
    </Stack>
  );
}
