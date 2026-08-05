"use client";

import { useActionState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import NextLink from "next/link";
import { MessageCircle } from "lucide-react";

import { forgotPasswordAction, type ForgotState } from "./actions";

export function ForgotForm() {
  const [state, action, pending] = useActionState<ForgotState, FormData>(
    forgotPasswordAction,
    {},
  );

  return (
    <Box component="form" action={action}>
      <Stack spacing={2}>
        {state.error && <Alert severity="error">{state.error}</Alert>}

        <TextField
          name="email"
          label="E-mail"
          type="email"
          autoComplete="username"
          required
          fullWidth
          autoFocus
          disabled={pending}
        />

        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          disabled={pending}
          startIcon={<MessageCircle size={18} />}
        >
          {pending ? "Enviando…" : "Enviar código por WhatsApp"}
        </Button>

        <Link
          component={NextLink}
          href="/login"
          variant="body2"
          sx={{ textAlign: "center" }}
        >
          Voltar para o login
        </Link>
      </Stack>
    </Box>
  );
}
