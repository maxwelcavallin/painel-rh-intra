"use client";

import { forwardRef } from "react";
import NextLink, { type LinkProps } from "next/link";

/**
 * Integração oficial MUI + Next.js para navegação client-side.
 *
 * Registrado uma vez no tema (`MuiLink.defaultProps.component` e
 * `MuiButtonBase.defaultProps.LinkComponent`), qualquer componente MUI que
 * receba `href` passa a navegar pelo roteador do Next — sem `component={NextLink}`
 * espalhado pelas páginas.
 *
 * Isto não é só conveniência: passar `component={NextLink}` a partir de um
 * Server Component quebra em runtime com "Functions cannot be passed directly
 * to Client Components", porque o componente é uma função cruzando a fronteira.
 * Amarrando aqui, dentro de um módulo de client, a fronteira nunca é cruzada.
 */
export const LinkBehavior = forwardRef<
  HTMLAnchorElement,
  Omit<LinkProps, "href"> & { href?: LinkProps["href"] }
>(function LinkBehavior({ href, ...props }, ref) {
  return <NextLink ref={ref} href={href ?? "#"} {...props} />;
});
