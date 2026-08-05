import { NextResponse } from "next/server";

import { HttpError, requireSessionApi } from "@/lib/dal";
import { lookupCep } from "@/server/viacep";

/**
 * Consulta de CEP para o formulário de cadastro.
 *
 * Existe como rota própria (e não como Server Action) porque o formulário
 * consulta enquanto a pessoa digita, sem submeter. Exige sessão como qualquer
 * outra rota — o proxy já barraria, mas a checagem é repetida aqui de propósito:
 * nunca confiar só no que o proxy deixou passar.
 */
export async function GET(request: Request) {
  try {
    await requireSessionApi();

    const cep = new URL(request.url).searchParams.get("cep") ?? "";
    const address = await lookupCep(cep);

    if (!address) {
      return NextResponse.json({ error: "CEP não encontrado." }, { status: 404 });
    }

    return NextResponse.json(address);
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro ao consultar o CEP." }, { status: 500 });
  }
}
