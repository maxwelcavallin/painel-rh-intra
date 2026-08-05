"use client";

import { useTransition } from "react";
import Switch from "@mui/material/Switch";
import Tooltip from "@mui/material/Tooltip";

import type { Channel, NotificationType } from "@/db/schema";

import { toggleChannelAction } from "./actions";

/**
 * Liga/desliga um canal para um tipo de comunicação.
 *
 * Client component de propósito: o Switch precisa reagir ao clique e submeter
 * sozinho. A alternativa — um `<input type="submit">` transparente por cima —
 * funciona por acidente e quebra a acessibilidade do controle.
 */
export function ChannelToggle({
  type,
  channel,
  enabled,
  disabled,
  hint,
  label,
}: {
  type: NotificationType;
  channel: Channel;
  enabled: boolean;
  disabled: boolean;
  hint: string;
  label: string;
}) {
  const [pending, startTransition] = useTransition();

  function toggle() {
    const data = new FormData();
    data.set("type", type);
    data.set("channel", channel);
    data.set("enabled", enabled ? "0" : "1");
    startTransition(() => toggleChannelAction(data));
  }

  return (
    <Tooltip
      title={
        disabled
          ? hint
          : enabled
            ? "Ligado — clique para desligar"
            : "Desligado — clique para ligar"
      }
      arrow
    >
      <span>
        <Switch
          checked={enabled}
          disabled={disabled || pending}
          onChange={toggle}
          size="small"
          slotProps={{ input: { "aria-label": label } }}
        />
      </span>
    </Tooltip>
  );
}
