"use client";

import { useActionState, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import NextLink from "next/link";
import { Eye, EyeOff, KeyRound } from "lucide-react";

import {
  resendCodeAction,
  resetPasswordAction,
  type ResetState,
} from "./actions";

export function ResetForm({
  initialEmail,
  justSent,
}: {
  initialEmail: string;
  justSent: boolean;
}) {
  const [state, action, pending] = useActionState<ResetState, FormData>(
    resetPasswordAction,
    {},
  );
  const [resendState, resendAction, resending] = useActionState<
    ResetState,
    FormData
  >(resendCodeAction, {});

  const [email, setEmail] = useState(initialEmail);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Stack spacing={2}>
      {justSent && !state.error && (
        <Alert severity="info">
          Se o e-mail estiver cadastrado, o código foi enviado por WhatsApp para
          o número do perfil. Ele vale por 15 minutos.
        </Alert>
      )}
      {resendState.resent && <Alert severity="info">Código reenviado.</Alert>}
      {state.error && <Alert severity="error">{state.error}</Alert>}

      <Box component="form" action={action}>
        <Stack spacing={2}>
          <TextField
            name="email"
            label="E-mail"
            type="email"
            autoComplete="username"
            required
            fullWidth
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
          />

          <TextField
            name="code"
            label="Código de 6 dígitos"
            required
            fullWidth
            autoFocus={Boolean(initialEmail)}
            disabled={pending}
            slotProps={{
              htmlInput: {
                inputMode: "numeric",
                maxLength: 6,
                style: { letterSpacing: "0.4em", fontSize: 20 },
              },
            }}
          />

          <TextField
            name="password"
            label="Nova senha"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            fullWidth
            disabled={pending}
            helperText="Mínimo de 8 caracteres, com letra e número."
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword((v) => !v)}
                      edge="end"
                      aria-label={
                        showPassword ? "Ocultar senha" : "Mostrar senha"
                      }
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />

          <TextField
            name="confirm"
            label="Confirmar nova senha"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            fullWidth
            disabled={pending}
          />

          <Button
            type="submit"
            variant="contained"
            size="large"
            fullWidth
            disabled={pending}
            startIcon={<KeyRound size={18} />}
          >
            {pending ? "Salvando…" : "Redefinir senha"}
          </Button>
        </Stack>
      </Box>

      <Box component="form" action={resendAction}>
        <input type="hidden" name="email" value={email} />
        <Button type="submit" size="small" fullWidth disabled={resending}>
          {resending ? "Reenviando…" : "Não recebi o código — reenviar"}
        </Button>
      </Box>

      <Link
        component={NextLink}
        href="/login"
        variant="body2"
        sx={{ textAlign: "center" }}
      >
        Voltar para o login
      </Link>
    </Stack>
  );
}
