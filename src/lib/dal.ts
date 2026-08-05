import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import type { Role } from "@/db/schema";

/**
 * Camada 2 de 2 do modelo "nenhuma rota pública" — esta é a que vale.
 *
 * O proxy é otimista (só lê cookie, e a doc do Next desaconselha depender dele).
 * Toda page, Server Action e Route Handler chama uma destas funções ANTES de
 * qualquer código de negócio. Checar de novo aqui é intencional: nunca confiar
 * no que o proxy deixou passar, nem no que a UI escondeu.
 *
 * Não fazer a checagem em `layout.tsx`: layout não re-renderiza a cada
 * navegação e não impede segmentos aninhados nem Server Actions de rodarem.
 */

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  sector: string | null;
};

/** `cache` memoiza durante um único render — várias chamadas, uma verificação. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;

  return {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    role: session.user.role,
    sector: session.user.sector ?? null,
  };
});

/** Exige sessão válida. Sem sessão, manda pro login — nunca retorna null. */
export async function requireSession(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Exige que o papel esteja na lista. Papel errado nunca vê a rota. */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireSession();
  if (!roles.includes(user.role)) redirect("/sem-permissao");
  return user;
}

/** Admin master (RH). */
export function requireRH() {
  return requireRole("admin");
}

/** Aprovações e dashboards de equipe: gestor ou RH. */
export function requireManagerOrRH() {
  return requireRole("gestor", "admin");
}

export function isRH(user: { role: Role }): boolean {
  return user.role === "admin";
}

export function isManagerOrRH(user: { role: Role }): boolean {
  return user.role === "gestor" || user.role === "admin";
}

/* ------------------------------------------------------------------ */
/* Variantes para Route Handlers — respondem status, não redirecionam  */
/* ------------------------------------------------------------------ */

export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export async function requireSessionApi(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "Não autenticado");
  return user;
}

export async function requireRoleApi(...roles: Role[]): Promise<SessionUser> {
  const user = await requireSessionApi();
  if (!roles.includes(user.role)) throw new HttpError(403, "Sem permissão");
  return user;
}
