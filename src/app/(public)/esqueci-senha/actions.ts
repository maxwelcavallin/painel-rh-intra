"use server";

import { redirect } from "next/navigation";

import { requestPasswordReset } from "@/server/password-reset";

export type ForgotState = { error?: string };

export async function forgotPasswordAction(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email || !email.includes("@")) {
    return { error: "Informe um e-mail válido." };
  }

  await requestPasswordReset(email);

  // Segue para a tela de código independentemente do e-mail existir —
  // a resposta precisa ser idêntica nos dois casos.
  redirect(`/redefinir-senha?email=${encodeURIComponent(email)}&enviado=1`);
}
