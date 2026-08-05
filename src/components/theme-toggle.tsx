"use client";

import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { useColorScheme } from "@mui/material/styles";
import { Monitor, Moon, Sun } from "lucide-react";

import { useHidratado } from "@/lib/client-state";

/**
 * Escolha de tema: claro, escuro ou o do sistema.
 *
 * `useColorScheme` guarda a escolha em localStorage e o
 * `InitColorSchemeScript` do layout a aplica antes da hidratação, então a
 * preferência sobrevive ao recarregamento sem piscar.
 *
 * "Sistema" é o padrão e fica como opção de verdade: quem já configurou o
 * sistema operacional em escuro não deveria precisar configurar de novo aqui,
 * e quem alterna ao longo do dia acompanha automaticamente.
 */
export function ThemeToggle() {
  const { mode, setMode } = useColorScheme();
  // O modo escolhido só existe no navegador. Marcar qual botão está ativo
  // antes de hidratar produziria marcação diferente da do servidor.
  const hidratado = useHidratado();

  return (
    <MenuItem
      disableRipple
      sx={{
        gap: 1.5,
        cursor: "default",
        "&:hover": { bgcolor: "transparent" },
      }}
    >
      <ListItemIcon sx={{ minWidth: "auto" }}>
        <Moon size={16} />
      </ListItemIcon>
      <ListItemText
        primary="Tema"
        slotProps={{ primary: { sx: { fontSize: 14 } } }}
      />
      <ToggleButtonGroup
        size="small"
        exclusive
        value={hidratado ? (mode ?? "system") : "system"}
        onChange={(_, v) => v && setMode(v)}
        sx={{ ml: 1 }}
      >
        <ToggleButton value="light" aria-label="Tema claro" sx={{ px: 1 }}>
          <Sun size={15} />
        </ToggleButton>
        <ToggleButton value="dark" aria-label="Tema escuro" sx={{ px: 1 }}>
          <Moon size={15} />
        </ToggleButton>
        <ToggleButton value="system" aria-label="Seguir o sistema" sx={{ px: 1 }}>
          <Monitor size={15} />
        </ToggleButton>
      </ToggleButtonGroup>
    </MenuItem>
  );
}
