"use server";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { requireRole } from "@/lib/dal";
import {
  gerarParecerGeral,
  gerarParecerIndividual,
  type FatosGerais,
  type FatosPessoa,
  type Parecer,
} from "@/server/parecer";

export type ParecerGeralState =
  | { ok: true; parecer: Parecer; fatos: FatosGerais }
  | { ok: false; error: string };

export type ParecerPessoaState =
  | { ok: true; parecer: Parecer; fatos: FatosPessoa }
  | { ok: false; error: string };

/**
 * Parecer da carteira. O escopo sai do papel de quem pediu — RH vê a empresa,
 * gestor vê a própria equipe —, então não há nada vindo do cliente para forjar.
 */
export async function gerarParecerGeralAction(): Promise<ParecerGeralState> {
  const solicitante = await requireRole("admin", "gestor");

  try {
    const { fatos, parecer } = await gerarParecerGeral(solicitante);
    return { ok: true, parecer, fatos };
  } catch (error) {
    console.error("[parecer-geral] falha:", error);
    return { ok: false, error: "Não foi possível gerar o parecer agora." };
  }
}

/**
 * Parecer de uma pessoa.
 *
 * Aqui o cliente escolhe o alvo, então a autorização precisa ser verificada
 * contra o banco: gestor só alcança quem se reporta a ele. O botão não aparecer
 * para colaborador não impede ninguém de chamar a action direto.
 */
export async function gerarParecerPessoaAction(
  userId: string,
): Promise<ParecerPessoaState> {
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
    const resultado = await gerarParecerIndividual(userId);
    if (!resultado) {
      return {
        ok: false,
        error: "Sem data de admissão cadastrada — não dá para calcular prazos.",
      };
    }
    return { ok: true, parecer: resultado.parecer, fatos: resultado.fatos };
  } catch (error) {
    console.error("[parecer-pessoa] falha:", error);
    return { ok: false, error: "Não foi possível gerar o parecer agora." };
  }
}
