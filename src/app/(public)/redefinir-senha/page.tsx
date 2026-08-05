import type { Metadata } from "next";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { Logo } from "@/components/logo";

import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Redefinir senha" };

export default async function RedefinirSenhaPage({
  searchParams,
}: PageProps<"/redefinir-senha">) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email : "";
  const justSent = params.enviado === "1";

  return (
    <Card sx={{ width: "100%", maxWidth: 400 }}>
      <CardContent sx={{ p: 4 }}>
        <Stack spacing={3}>
          <Stack spacing={1.5} sx={{ alignItems: "center" }}>
            <Logo size={40} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Redefinir senha
            </Typography>
          </Stack>

          <ResetForm initialEmail={email} justSent={justSent} />
        </Stack>
      </CardContent>
    </Card>
  );
}
