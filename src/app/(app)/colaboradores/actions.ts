"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { Role } from "@/db/schema";
import { requireRH } from "@/lib/dal";
import {
  createEmployee,
  updateEmployee,
  type EmployeeInput,
} from "@/server/employees";

export type EmployeeState = { error?: string; ok?: boolean };

function readInput(formData: FormData): EmployeeInput {
  const text = (key: string) => {
    const value = formData.get(key);
    const s = typeof value === "string" ? value.trim() : "";
    return s ? s : null;
  };

  return {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    role: (String(formData.get("role") ?? "user") as Role),
    isActive: formData.get("isActive") === "on",
    sector: text("sector"),
    position: text("position"),
    managerId: text("managerId"),
    admissionDate: text("admissionDate"),
    employmentType: text("employmentType"),
    employmentStatus: text("employmentStatus"),
    phone: text("phone"),
    discordHandle: text("discordHandle"),
    personalEmail: text("personalEmail"),
    zipCode: text("zipCode"),
    addressStreet: text("addressStreet"),
    addressNumber: text("addressNumber"),
    addressComplement: text("addressComplement"),
    neighborhood: text("neighborhood"),
    city: text("city"),
    state: text("state"),
    birthDate: text("birthDate"),
    gender: text("gender"),
    rg: text("rg"),
    cpf: text("cpf"),
    fatherName: text("fatherName"),
    motherName: text("motherName"),
    birthplace: text("birthplace"),
    educationLevel: text("educationLevel"),
    courseName: text("courseName"),
    institution: text("institution"),
  };
}

export async function createEmployeeAction(
  _prev: EmployeeState,
  formData: FormData,
): Promise<EmployeeState> {
  // Só o admin master (RH) cadastra. Checado aqui, não só na navegação.
  await requireRH();

  const result = await createEmployee(
    readInput(formData),
    String(formData.get("password") ?? ""),
  );

  if (!result.ok) return { error: result.error };

  revalidatePath("/colaboradores");
  redirect("/colaboradores?salvo=1");
}

export async function updateEmployeeAction(
  _prev: EmployeeState,
  formData: FormData,
): Promise<EmployeeState> {
  await requireRH();

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Colaborador não informado." };

  const password = String(formData.get("password") ?? "").trim();

  const result = await updateEmployee(id, readInput(formData), password || null);

  if (!result.ok) return { error: result.error };

  revalidatePath("/colaboradores");
  revalidatePath(`/colaboradores/${id}`);
  redirect("/colaboradores?salvo=1");
}
