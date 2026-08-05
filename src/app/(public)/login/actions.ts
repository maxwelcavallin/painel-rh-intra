"use server";

import { AuthError } from "next-auth";
import { unstable_rethrow } from "next/navigation";

import { signIn } from "@/auth";

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") ?? "/");

  if (!email || !password) {
    return { error: "Informe e-mail e senha." };
  }

  // Só aceita destino interno — senão vira open redirect.
  const redirectTo = callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
    ? callbackUrl
    : "/";

  try {
    await signIn("credentials", { email, password, redirectTo });
  } catch (error) {
    // `signIn` sinaliza sucesso lançando um redirect — precisa subir intacto.
    unstable_rethrow(error);

    if (error instanceof AuthError) {
      // Mensagem única de propósito: não revela se o e-mail existe.
      return { error: "E-mail ou senha inválidos." };
    }
    throw error;
  }

  return {};
}
