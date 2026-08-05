import "server-only";

import { and, asc, eq, ne, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { users } from "@/db/schema";
import type { Role } from "@/db/schema";
import { isValidCpf, onlyDigits } from "@/lib/format";
import { isCuritibaMetro } from "@/lib/rmc";
import { hashPassword } from "@/lib/password";

/**
 * Cadastro de colaboradores — exclusivo do RH (admin master).
 *
 * A autorização NÃO é checada aqui: quem chama (Server Action) já passou pelo
 * DAL. O que este módulo garante é a integridade do dado — CPF válido, e-mail
 * único, `isCuritibaMetro` derivado, gestor coerente.
 */

export type EmployeeInput = {
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  sector: string | null;
  position: string | null;
  managerId: string | null;
  admissionDate: string | null;
  employmentType: string | null;
  employmentStatus: string | null;
  phone: string | null;
  discordHandle: string | null;
  personalEmail: string | null;
  zipCode: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  birthDate: string | null;
  gender: string | null;
  rg: string | null;
  cpf: string | null;
  fatherName: string | null;
  motherName: string | null;
  birthplace: string | null;
  educationLevel: string | null;
  courseName: string | null;
  institution: string | null;
};

export type SaveResult =
  | { ok: true; id: string; isCuritibaMetro: boolean }
  | { ok: false; error: string };

const EMPLOYMENT_TYPES = ["clt", "pj", "estagio", "aprendiz", "socio"] as const;
const EMPLOYMENT_STATUSES = ["ativo", "afastado", "ferias", "desligado"] as const;

function clean(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function validate(input: EmployeeInput): string | null {
  if (!input.name.trim()) return "Informe o nome do colaborador.";
  if (!input.email.trim().includes("@")) return "Informe um e-mail válido.";

  // CPF é opcional, mas se vier tem que ser real — dígito verificador confere.
  if (input.cpf && !isValidCpf(input.cpf)) {
    return "CPF inválido. Confira os dígitos.";
  }
  if (input.employmentType && !EMPLOYMENT_TYPES.includes(input.employmentType as never)) {
    return "Tipo de contrato inválido.";
  }
  if (
    input.employmentStatus &&
    !EMPLOYMENT_STATUSES.includes(input.employmentStatus as never)
  ) {
    return "Situação inválida.";
  }
  return null;
}

/** Campos derivados e normalizados, aplicados tanto na criação quanto na edição. */
function toRow(input: EmployeeInput) {
  const city = clean(input.city);
  const state = clean(input.state);

  return {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    role: input.role,
    isActive: input.isActive,
    sector: clean(input.sector),
    position: clean(input.position),
    managerId: input.managerId,
    admissionDate: clean(input.admissionDate),
    employmentType: (clean(input.employmentType) ?? null) as never,
    employmentStatus: (clean(input.employmentStatus) ?? "ativo") as never,
    phone: clean(input.phone),
    discordHandle: clean(input.discordHandle),
    personalEmail: clean(input.personalEmail),
    zipCode: input.zipCode ? onlyDigits(input.zipCode) : null,
    addressStreet: clean(input.addressStreet),
    addressNumber: clean(input.addressNumber),
    addressComplement: clean(input.addressComplement),
    neighborhood: clean(input.neighborhood),
    city,
    state: state ? state.toUpperCase() : null,
    // DERIVADO, nunca digitado — muda sozinho se o endereço mudar.
    isCuritibaMetro: isCuritibaMetro(city, state),
    birthDate: clean(input.birthDate),
    gender: clean(input.gender),
    rg: clean(input.rg),
    cpf: input.cpf ? onlyDigits(input.cpf) : null,
    fatherName: clean(input.fatherName),
    motherName: clean(input.motherName),
    birthplace: clean(input.birthplace),
    educationLevel: clean(input.educationLevel),
    courseName: clean(input.courseName),
    institution: clean(input.institution),
    updatedAt: new Date(),
  };
}

async function emailTaken(email: string, exceptId?: string): Promise<boolean> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(
      exceptId
        ? and(eq(users.email, email), ne(users.id, exceptId))
        : eq(users.email, email),
    )
    .limit(1);
  return rows.length > 0;
}

export async function createEmployee(
  input: EmployeeInput,
  initialPassword: string,
): Promise<SaveResult> {
  const invalid = validate(input);
  if (invalid) return { ok: false, error: invalid };

  if (initialPassword.length < 8) {
    return { ok: false, error: "A senha inicial precisa ter ao menos 8 caracteres." };
  }

  const row = toRow(input);

  if (await emailTaken(row.email)) {
    return { ok: false, error: "Já existe um colaborador com este e-mail." };
  }

  const [created] = await db
    .insert(users)
    .values({ ...row, passwordHash: await hashPassword(initialPassword) })
    .returning({ id: users.id });

  return { ok: true, id: created.id, isCuritibaMetro: row.isCuritibaMetro };
}

export async function updateEmployee(
  id: string,
  input: EmployeeInput,
  /** Vazio = mantém a senha atual. */
  newPassword: string | null,
): Promise<SaveResult> {
  const invalid = validate(input);
  if (invalid) return { ok: false, error: invalid };

  if (newPassword && newPassword.length < 8) {
    return { ok: false, error: "A nova senha precisa ter ao menos 8 caracteres." };
  }
  if (input.managerId === id) {
    return { ok: false, error: "Um colaborador não pode ser gestor de si mesmo." };
  }

  const row = toRow(input);

  if (await emailTaken(row.email, id)) {
    return { ok: false, error: "Já existe outro colaborador com este e-mail." };
  }

  await db
    .update(users)
    .set(
      newPassword
        ? { ...row, passwordHash: await hashPassword(newPassword) }
        : row,
    )
    .where(eq(users.id, id));

  return { ok: true, id, isCuritibaMetro: row.isCuritibaMetro };
}

/* ------------------------------------------------------------------ */
/* Consultas                                                           */
/* ------------------------------------------------------------------ */

/** Listagem: sem CPF e sem RG. Dado sensível não sai do banco à toa. */
export async function listEmployees() {
  // `alias` é obrigatório para auto-join: sem ele o Drizzle referencia a mesma
  // tabela duas vezes e o SQL sai ambíguo.
  const managers = alias(users, "managers");

  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      sector: users.sector,
      position: users.position,
      isActive: users.isActive,
      employmentStatus: users.employmentStatus,
      city: users.city,
      state: users.state,
      isCuritibaMetro: users.isCuritibaMetro,
      phone: users.phone,
      admissionDate: users.admissionDate,
      managerId: users.managerId,
      managerName: managers.name,
    })
    .from(users)
    .leftJoin(managers, eq(managers.id, users.managerId))
    .orderBy(asc(users.name));
}

export async function getEmployee(id: string) {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

/** Candidatos a gestor: quem tem papel `gestor` ou `admin`, exceto a própria pessoa. */
export async function listManagerCandidates(exceptId?: string) {
  return db
    .select({ id: users.id, name: users.name, sector: users.sector })
    .from(users)
    .where(
      and(
        eq(users.isActive, true),
        or(eq(users.role, "gestor"), eq(users.role, "admin")),
        exceptId ? ne(users.id, exceptId) : undefined,
      ),
    )
    .orderBy(asc(users.name));
}
