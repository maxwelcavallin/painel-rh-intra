"use server";

import { requireRole } from "@/lib/dal";
import { gerarParecerGeral, type FatosGerais, type Parecer } from "@/server/parecer";

export type ParecerState =
  | { ok: true; parecer: Parecer; fatos: FatosGerais }
  | { ok: false; error: string };

/**
 * Gera o parecer de risco da carteira de férias.
 *
 * A autorização é checada AQUI, junto do dado, e não só na tela: o botão só
 * aparecer para RH e gestor não impede ninguém de chamar a action direto. O
 * escopo sai do papel de quem pediu — RH vê a empresa, gestor vê a própria
 * equipe —, então não há nada vindo do cliente para forjar.
 */
export async function gerarParecerAction(): Promise<ParecerState> {
  const solicitante = await requireRole("admin", "gestor");

  try {
    const { fatos, parecer } = await gerarParecerGeral(solicitante);
    return { ok: true, parecer, fatos };
  } catch (error) {
    console.error("[parecer] falha:", error);
    return { ok: false, error: "Não foi possível gerar o parecer agora." };
  }
}
