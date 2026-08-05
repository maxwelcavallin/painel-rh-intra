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
import { Eye, EyeOff, LogIn } from "lucide-react";

import { loginAction, type LoginState } from "./actions";

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    loginAction,
    {},
  );
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Box component="form" action={action}>
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

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

        <TextField
          name="password"
          label="Senha"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          required
          fullWidth
          disabled={pending}
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword((v) => !v)}
                    edge="end"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />

        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          disabled={pending}
          startIcon={<LogIn size={18} />}
        >
          {pending ? "Entrando…" : "Entrar"}
        </Button>

        <Link
          component={NextLink}
          href="/esqueci-senha"
          variant="body2"
          sx={{ textAlign: "center" }}
        >
          Esqueci minha senha
        </Link>
      </Stack>
    </Box>
  );
}
