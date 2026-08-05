import type { Metadata } from "next";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { Logo } from "@/components/logo";

import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Esqueci minha senha" };

export default function EsqueciSenhaPage() {
  return (
    <Card sx={{ width: "100%", maxWidth: 400 }}>
      <CardContent sx={{ p: 4 }}>
        <Stack spacing={3}>
          <Stack spacing={1.5} sx={{ alignItems: "center" }}>
            <Logo size={40} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Recuperar senha
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: "text.secondary", textAlign: "center" }}
            >
              Informe seu e-mail. Enviaremos um código de 6 dígitos por WhatsApp
              para o número cadastrado no seu perfil.
            </Typography>
          </Stack>

          <ForgotForm />
        </Stack>
      </CardContent>
    </Card>
  );
}
