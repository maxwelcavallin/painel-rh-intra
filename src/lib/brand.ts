/**
 * Constantes da marca 01 Tecnologia.
 *
 * SEM `"use client"` de propósito. Server Components (Logo, StatusChip) e o
 * tema (client) importam daqui. Quando estas constantes moravam em `theme.ts`,
 * que é `"use client"`, um Server Component que as importasse recebia uma
 * referência de client em vez do valor — `mosaic[500]` virava `undefined` e a
 * logo saía transparente. Constante compartilhada não pode morar em módulo de client.
 */

/**
 * Paleta mosaico — decorativa, extraída do grid da logo.
 * Usar em ilustrações, avatares e chips secundários. NUNCA como cor de ação.
 */
export const mosaic = {
  100: "#DDE4EA",
  300: "#8AA0B4",
  500: "#6C849C",
  700: "#546C84",
  gray: "#D0D0D0",
} as const;

/**
 * A mesma paleta para o modo escuro.
 *
 * Os tons claros do mosaico (#DDE4EA) somem sobre fundo escuro e os escuros
 * (#546C84) viram borrão. Aqui a escala é reordenada para a leitura continuar
 * a mesma: `100` segue sendo o mais claro do conjunto, só que agora "claro"
 * quer dizer legível sobre escuro.
 */
export const mosaicDark = {
  100: "#C3D2DF",
  300: "#9CB1C4",
  500: "#7C93A9",
  700: "#5E7386",
  gray: "#4A5560",
} as const;

/**
 * Mapa único de status → cor do tema.
 * Reaproveitado em Chips de férias e de formulários — nunca cor "livre".
 */
export const statusColor = {
  pending: "warning",
  approved: "success",
  rejected: "error",
  // Cancelada não é falha nem sucesso — é saída neutra do fluxo.
  cancelled: "default",
} as const;

export const statusLabel = {
  pending: "Pendente",
  approved: "Aprovada",
  rejected: "Reprovada",
  cancelled: "Cancelada",
} as const;

export type VacationStatus = keyof typeof statusLabel;

/**
 * Família tipográfica com fallback DENTRO do `var()`.
 *
 * Sem o fallback interno, se `--font-roboto` não estiver definida a declaração
 * inteira vira inválida e o navegador cai no serifado padrão — não no
 * sans-serif do fim da lista.
 */
export const FONT_FAMILY = "var(--font-roboto, Roboto), Roboto, Inter, sans-serif";
