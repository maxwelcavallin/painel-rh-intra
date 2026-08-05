import { Roboto } from "next/font/google";

/**
 * Carregamento da fonte via `next/font`.
 *
 * SEM `"use client"`: o `layout.tsx` é Server Component e precisa do valor real
 * de `roboto.variable`. Importado de um módulo de client, ele chegava como
 * `undefined` e o `<html>` ficava sem classe nenhuma.
 *
 * O DS do Obra Play registra "fonte declarada mas nunca carregada" como
 * inconsistência conhecida — aqui ela é carregada de verdade.
 */
export const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-roboto",
});
