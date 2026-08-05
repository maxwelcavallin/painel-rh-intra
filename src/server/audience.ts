import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";

/**
 * Resolução de audiência — compartilhada por avisos (Fase 3) e formulários
 * (Fase 4). Extraído para cá porque as duas features precisam exatamente da
 * mesma regra, e duplicar isso significaria corrigir bug em dois lugares.
 */

export type AudienceType = "all" | "sector" | "role" | "user" | "location";

export type Audience = {
  type: AudienceType;
  /** Setor, papel, id de usuário, ou "rmc"/"fora_rmc". Null quando `all`. */
  value: string | null;
};

export type Recipient = {
  id: string;
  name: string;
  phone: string | null;
  managerId: string | null;
};

/** Quem se encaixa. Sempre só gente com acesso ativo — desligado não recebe nada. */
export async function resolveAudience(audience: Audience): Promise<Recipient[]> {
  const active = eq(users.isActive, true);

  const scope = (() => {
    switch (audience.type) {
      case "sector":
        return audience.value ? eq(users.sector, audience.value) : null;
      case "role":
        return audience.value
          ? eq(users.role, audience.value as "user" | "gestor" | "admin")
          : null;
      case "user":
        return audience.value ? eq(users.id, audience.value) : null;
      case "location":
        // Usa o flag `isCuritibaMetro`, derivado no cadastro (Fase 2).
        return eq(users.isCuritibaMetro, audience.value !== "fora_rmc");
      case "all":
      default:
        return null;
    }
  })();

  // Audiência que exige valor mas veio sem ele não seleciona NINGUÉM.
  // Cair para "todo mundo" aqui mandaria um comunicado de setor para a empresa inteira.
  if (audience.type !== "all" && scope === null) return [];

  return db
    .select({
      id: users.id,
      name: users.name,
      phone: users.phone,
      managerId: users.managerId,
    })
    .from(users)
    .where(scope ? and(active, scope) : active)
    .orderBy(users.name);
}

export function describeAudience(audience: Audience): string {
  switch (audience.type) {
    case "sector":
      return `Setor: ${audience.value}`;
    case "role":
      return `Papel: ${audience.value}`;
    case "user":
      return "Pessoa específica";
    case "location":
      return audience.value === "fora_rmc"
        ? "Fora da Região Metropolitana de Curitiba"
        : "Região Metropolitana de Curitiba";
    case "all":
    default:
      return "Todos os colaboradores";
  }
}

export async function listSectors(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ sector: users.sector })
    .from(users)
    .where(eq(users.isActive, true));

  return rows
    .map((r) => r.sector)
    .filter((s): s is string => Boolean(s))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** Lista enxuta para os seletores de "uma pessoa" nos formulários. */
export async function listActivePeople() {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.isActive, true))
    .orderBy(users.name);
}
