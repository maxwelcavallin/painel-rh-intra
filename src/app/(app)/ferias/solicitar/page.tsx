import type { Metadata } from "next";
import Alert from "@mui/material/Alert";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { requireSession } from "@/lib/dal";

import { RequestForm } from "./request-form";

export const metadata: Metadata = { title: "Solicitar férias" };

export default async function SolicitarPage() {
  // Rota autenticada: nome, e-mail e setor vêm da sessão, não de campo digitável.
  const user = await requireSession();

  return (
    <Stack spacing={3} sx={{ maxWidth: 760 }}>
      <Stack spacing={0.5}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Solicitar férias
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Solicitando como <strong>{user.name}</strong>
          {user.sector ? ` · ${user.sector}` : ""}
        </Typography>
      </Stack>

      <Alert severity="info">
        A solicitação é analisada na hora: o sistema confere saldo do período
        aquisitivo, sobreposição com a equipe e as vedações da CLT — inclusive a
        do art. 134, §3º, que proíbe iniciar férias nos dois dias que antecedem
        feriado ou o repouso semanal.
      </Alert>

      <Card>
        <CardContent sx={{ p: 3 }}>
          <RequestForm />
        </CardContent>
      </Card>
    </Stack>
  );
}
