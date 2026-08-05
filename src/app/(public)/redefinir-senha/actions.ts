"use server";

import { redirect } from "next/navigation";

import {
  confirmPasswordReset,
  requestPasswordReset,
  validatePasswordStrength,
} from "@/server/password-reset";

export type ResetState = { error?: string; resent?: boolean };

export async function resetPasswordAction(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const email = String(formData.get("email") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password !== confirm) {
    return { error: "As senhas não coincidem." };
  }

  const weak = validatePasswordStrength(password);
  if (weak) return { error: weak };

  const result = await confirmPasswordReset({
    email,
    code,
    newPassword: password,
  });

  if (!result.ok) return { error: result.error };

  redirect("/login?senhaAlterada=1");
}

export async function resendCodeAction(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Informe o e-mail para reenviar o código." };

  await requestPasswordReset(email);
  return { resent: true };
}
