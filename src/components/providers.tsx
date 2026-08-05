"use client";

import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { ptBR } from "date-fns/locale";

import { theme } from "@/theme";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LocalizationProvider
        dateAdapter={AdapterDateFns}
        adapterLocale={ptBR}
        localeText={{
          cancelButtonLabel: "Cancelar",
          okButtonLabel: "Confirmar",
          todayButtonLabel: "Hoje",
        }}
      >
        {children}
      </LocalizationProvider>
    </ThemeProvider>
  );
}
