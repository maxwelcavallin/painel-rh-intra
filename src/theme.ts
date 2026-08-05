"use client";

import { createTheme } from "@mui/material/styles";
import { ptBR } from "@mui/material/locale";

import { LinkBehavior } from "@/components/link-behavior";
import { FONT_FAMILY, mosaic, mosaicDark } from "@/lib/brand";

/**
 * Design System 01 Tecnologia, em dois esquemas.
 *
 * As cores da marca vieram por amostragem de pixel do logo.jpg e da tela de
 * login. Regra do DS: nunca hex solto no componente — sempre `theme.palette.*`.
 * Com dois esquemas isso deixa de ser preferência e vira obrigação: hex fixo em
 * componente não sabe em qual modo está e quebra num dos dois.
 *
 * O escuro NÃO é o claro invertido. O azul da marca (#2C5F8A) não tem contraste
 * suficiente sobre fundo escuro, então o modo escuro promove o tom claro da
 * marca a cor de ação e usa superfícies com um leve viés azul, para o produto
 * continuar parecendo da 01 Tec em vez de virar cinza genérico.
 *
 * Este módulo é `"use client"` (createTheme roda no client). Por isso as
 * constantes compartilhadas vivem em `@/lib/brand`, que não é client — assim
 * Server Components conseguem importá-las de verdade. Ver o comentário lá.
 */

/**
 * `string` e não `typeof mosaic`: com `as const` os valores viram tipos
 * literais, e a paleta escura — com outros hexadecimais — deixaria de ser
 * atribuível à mesma chave.
 */
type MosaicPalette = Record<keyof typeof mosaic, string>;

declare module "@mui/material/styles" {
  interface Palette {
    mosaic: MosaicPalette;
  }
  interface PaletteOptions {
    mosaic?: MosaicPalette;
  }
}

export const theme = createTheme(
  {
    /**
     * `colorSchemeSelector: "data"` gera as regras sob
     * `[data-mui-color-scheme="dark"]` — o mesmo atributo que o
     * `InitColorSchemeScript` escreve no `<html>` antes da hidratação. Sem
     * casar os dois, a escolha do usuário não pinta nada.
     */
    cssVariables: { colorSchemeSelector: "data" },
    colorSchemes: {
      light: {
        palette: {
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
      },
      dark: {
        palette: {
          // O azul da marca vira o tom claro: #2C5F8A sobre fundo escuro fica
          // abaixo do contraste mínimo para texto e para foco de teclado.
          primary: {
            main: "#7FA9CE",
            dark: "#5B85AC",
            light: "#A8C6E0",
            contrastText: "#0E1620",
          },
          secondary: {
            main: "#8AA0B4",
            dark: "#6C849C",
            light: "#B0C0CE",
            contrastText: "#0E1620",
          },
          // O par claro de cada estado vira um fundo escuro tingido: em modo
          // escuro `light` é usado como superfície de Alert, não como texto.
          success: { main: "#6FBF73", light: "#16301C" },
          warning: { main: "#FFB74D", light: "#3A2611" },
          error: { main: "#F28B82", light: "#3A1B1B" },
          info: { main: "#64B5F6", light: "#10283C" },
          // Superfícies com viés azul, não cinza puro — mantém a marca.
          background: { default: "#0E1620", paper: "#16212C" },
          text: { primary: "#E4EBF1", secondary: "#9BABB8" },
          divider: "rgba(255,255,255,0.12)",
          mosaic: mosaicDark,
        },
      },
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
          root: ({ theme }) => ({
            borderRadius: 8,
            // Sombra tingida do azul da marca, não preto puro. No escuro a
            // sombra some (fundo escuro não recebe sombra) e o relevo passa a
            // vir da borda.
            ...theme.applyStyles("light", {
              boxShadow: "0 1px 3px rgba(44,95,138,0.10)",
            }),
            ...theme.applyStyles("dark", {
              boxShadow: "none",
              border: "1px solid",
              borderColor: theme.palette.divider,
            }),
          }),
        },
      },
      MuiAppBar: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundImage: "none",
            // No claro a barra é o azul da marca. No escuro, azul saturado no
            // topo de uma tela escura cansa a vista e rouba atenção do
            // conteúdo — vira superfície, com a marca vindo da logo.
            ...theme.applyStyles("light", {
              backgroundColor: theme.palette.primary.main,
              color: theme.palette.primary.contrastText,
            }),
            ...theme.applyStyles("dark", {
              backgroundColor: theme.palette.background.paper,
              color: theme.palette.text.primary,
              borderBottom: "1px solid",
              borderBottomColor: theme.palette.divider,
            }),
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
