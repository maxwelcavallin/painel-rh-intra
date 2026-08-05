import "server-only";

import { onlyDigits } from "@/lib/format";

/**
 * ViaCEP — autopreenchimento de endereço a partir do CEP.
 *
 * Nunca lança: CEP é conveniência, não pode impedir o RH de salvar um cadastro.
 * Quando falha, devolve `null` e a pessoa digita o endereço à mão.
 */

export type Address = {
  zipCode: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
};

type ViaCepResponse = {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean | string;
};

export async function lookupCep(rawCep: string): Promise<Address | null> {
  const cep = onlyDigits(rawCep);
  if (cep.length !== 8) return null;

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      // CEP praticamente não muda; uma semana de cache é conservador.
      next: { revalidate: 604_800 },
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as ViaCepResponse;

    // A ViaCEP responde 200 com `{"erro": true}` para CEP inexistente —
    // checar só o status HTTP daria falso positivo.
    if (data.erro || !data.localidade || !data.uf) return null;

    return {
      zipCode: cep,
      street: data.logradouro ?? "",
      neighborhood: data.bairro ?? "",
      city: data.localidade,
      state: data.uf,
    };
  } catch {
    return null;
  }
}
