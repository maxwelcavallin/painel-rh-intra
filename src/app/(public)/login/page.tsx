import type { Metadata } from "next";
import Alert from "@mui/material/Alert";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { Logo } from "@/components/logo";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const params = await searchParams;
  const raw = params.callbackUrl;
  const callbackUrl = typeof raw === "string" ? raw : "/";

  return (
    <Card sx={{ width: "100%", maxWidth: 400 }}>
      <CardContent sx={{ p: 4 }}>
        <Stack spacing={3}>
          <Stack spacing={1.5} sx={{ alignItems: "center" }}>
            <Logo size={44} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Intranet RH
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: "text.secondary", textAlign: "center" }}
            >
              Entre com suas credenciais para acessar férias, avisos e
              formulários.
            </Typography>
          </Stack>

          {params.senhaAlterada === "1" && (
            <Alert severity="success">
              Senha redefinida. Entre com a nova senha.
            </Alert>
          )}

          <Divider />

          <LoginForm callbackUrl={callbackUrl} />
        </Stack>
      </CardContent>
    </Card>
  );
}
