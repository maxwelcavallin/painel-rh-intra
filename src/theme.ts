"use client";

import { createTheme } from "@mui/material/styles";
import { ptBR } from "@mui/material/locale";

import { LinkBehavior } from "@/components/link-behavior";
import { FONT_FAMILY, mosaic } from "@/lib/brand";

/**
 * Design System 01 Tecnologia.
 * As cores da marca vieram por amostragem de pixel do logo.jpg e da tela de login.
 * Regra do DS: nunca hex solto no componente — sempre `theme.palette.*`.
 *
 * MODO CLARO APENAS, por decisão de produto. Houve uma versão escura em
 * 05/08/2026 e ela foi retirada por não ter ficado boa — reintroduzir exige
 * mais que inverter a paleta: a AppBar azul, os chips de status e as sombras
 * tingidas de azul foram todos desenhados assumindo fundo claro.
 *
 * Este módulo é `"use client"` (createTheme roda no client). Por isso as
 * constantes compartilhadas vivem em `@/lib/brand`, que não é client — assim
 * Server Components conseguem importá-las de verdade. Ver o comentário lá.
 */

declare module "@mui/material/styles" {
  interface Palette {
    mosaic: typeof mosaic;
  }
  interface PaletteOptions {
    mosaic?: typeof mosaic;
  }
}

export const theme = createTheme(
  {
    cssVariables: true,
    palette: {
      mode: "light",
      primary: {
        main: "#2C5F8A",
        dark: "#1B3D59",
        light: "#5B85AC",
        contrastText: "#FFFFFF",
      },
      secondary: {
        main: "#6C849C",
        dark: "#546C84",
        light: "#8AA0B4",
        contrastText: "#FFFFFF",
      },
      success: { main: "#2E7D32", light: "#E8F5E9" },
      warning: { main: "#ED6C02", light: "#FFF3E0" },
      error: { main: "#D32F2F", light: "#FFEBEE" },
      info: { main: "#0288D1", light: "#E3F2FD" },
      background: { default: "#F4F6F8", paper: "#FFFFFF" },
      text: { primary: "#212B33", secondary: "#63707B" },
      divider: "#E4E8EC",
      mosaic,
    },
    shape: { borderRadius: 8 },
    typography: {
      fontFamily: FONT_FAMILY,
      fontSize: 14,
      button: {
        textTransform: "uppercase",
        fontWeight: 500,
        letterSpacing: "0.02857em",
      },
    },
    components: {
      // Qualquer componente MUI com `href` navega pelo roteador do Next.
      // Ver o comentário em `link-behavior.tsx` — evita passar componente
      // como prop através da fronteira server→client.
      MuiLink: {
        defaultProps: { component: LinkBehavior },
      },
      MuiButtonBase: {
        defaultProps: { LinkComponent: LinkBehavior },
      },
      MuiButton: {
        styleOverrides: { root: { borderRadius: 4, minHeight: 36 } },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            // Sombra tingida do azul da marca, não preto puro.
            boxShadow: "0 1px 3px rgba(44,95,138,0.10)",
          },
        },
      },
      MuiAppBar: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor: theme.palette.primary.main,
            backgroundImage: "none",
          }),
        },
      },
      MuiChip: {
        styleOverrides: { root: { fontWeight: 500 } },
      },
    },
  },
  ptBR,
);
