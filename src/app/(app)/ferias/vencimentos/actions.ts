"use server";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { requireRole } from "@/lib/dal";
import { gerarParecer, type FatosParecer, type Parecer } from "@/server/parecer";

export type ParecerState =
  | { ok: true; parecer: Parecer; fatos: FatosParecer }
  | { ok: false; error: string };

/**
 * Gera o parecer de risco de uma pessoa.
 *
 * A autorização é checada AQUI, junto do dado, e não só na tela: o botão só
 * aparecer para RH e gestor não impede ninguém de chamar a action direto.
 * Gestor só alcança quem se reporta a ele — o mesmo recorte da fila de
 * aprovação, aplicado na consulta.
 */
export async function gerarParecerAction(userId: string): Promise<ParecerState> {
  const solicitante = await requireRole("admin", "gestor");

  if (!userId) return { ok: false, error: "Colaborador não informado." };

  const [alvo] = await db
    .select({ id: users.id, managerId: users.managerId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!alvo) return { ok: false, error: "Colaborador não encontrado." };

  if (solicitante.role !== "admin" && alvo.managerId !== solicitante.id) {
    return {
      ok: false,
      error: "Você só pode gerar parecer de quem se reporta a você.",
    };
  }

  try {
    const resultado = await gerarParecer(userId);
    if (!resultado) {
      return {
        ok: false,
        error: "Sem data de admissão cadastrada — não dá para calcular prazos.",
      };
    }
    return { ok: true, parecer: resultado.parecer, fatos: resultado.fatos };
  } catch (error) {
    console.error("[parecer] falha:", error);
    return { ok: false, error: "Não foi possível gerar o parecer agora." };
  }
}
