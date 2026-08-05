import type { Metadata } from "next";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { ShieldAlert } from "lucide-react";

import { requireSession } from "@/lib/dal";

export const metadata: Metadata = { title: "Sem permissão" };

export default async function SemPermissaoPage() {
  await requireSession();

  return (
    <Card sx={{ maxWidth: 480, mx: "auto", mt: 6 }}>
      <CardContent sx={{ p: 4 }}>
        <Stack spacing={2} sx={{ alignItems: "center", textAlign: "center" }}>
          <ShieldAlert size={40} color="#ED6C02" />
          <Typography variant="h6">Você não tem acesso a esta área</Typography>
          <Typography variant="body2" color="text.secondary">
            Esta página é restrita a outro perfil de usuário. Se você acha que
            deveria ter acesso, fale com o RH.
          </Typography>
          <Button href="/" variant="contained">
            Voltar ao início
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
