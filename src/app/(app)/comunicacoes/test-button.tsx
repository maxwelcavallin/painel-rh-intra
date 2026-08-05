"use client";

import { useActionState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import { Send } from "lucide-react";

import type { NotificationType } from "@/db/schema";

import { sendTestAction, type ChannelState } from "./actions";

/**
 * Dispara uma mensagem de teste do tipo para o próprio RH.
 * Confere o webhook antes de a primeira mensagem real sair errada.
 */
export function TestButton({
  type,
  label,
}: {
  type: NotificationType;
  label: string;
}) {
  const [state, action, pending] = useActionState<ChannelState, FormData>(
    sendTestAction,
    {},
  );

  return (
    <Box component="form" action={action}>
      <input type="hidden" name="type" value={type} />
      <Tooltip
        title={state.error ?? state.ok ?? `Enviar teste de "${label}" para você`}
        arrow
      >
        <span>
          <Button
            type="submit"
            size="small"
            disabled={pending}
            color={state.error ? "error" : state.ok ? "success" : "primary"}
            startIcon={<Send size={14} />}
          >
            {pending ? "…" : state.ok ? "ok" : state.error ? "falhou" : "testar"}
          </Button>
        </span>
      </Tooltip>
    </Box>
  );
}
