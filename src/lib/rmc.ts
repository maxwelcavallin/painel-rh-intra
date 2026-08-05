/**
 * Região Metropolitana de Curitiba — os 29 municípios.
 *
 * Puro, sem banco e sem rede: dá para testar sozinho (`scripts/smoke-cadastro.ts`).
 *
 * O campo `users.isCuritibaMetro` é DERIVADO — calculado no save a partir da
 * cidade/UF, nunca digitado. Se alguém mudar o endereço, o flag acompanha.
 */

/** Sem acento, sem caixa, sem espaço duplicado — para comparar nome de cidade. */
export function normalizeCity(value: string): string {
  return value
    .normalize("NFD")
    // Faixa dos diacríticos combinantes. Escape Unicode, não o caractere
    // literal: acento solto no fonte é frágil e some em copy/paste.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Nomes oficiais, na grafia do IBGE. */
export const RMC_MUNICIPALITIES = [
  "Adrianópolis",
  "Agudos do Sul",
  "Almirante Tamandaré",
  "Araucária",
  "Balsa Nova",
  "Bocaiúva do Sul",
  "Campina Grande do Sul",
  "Campo do Tenente",
  "Campo Largo",
  "Campo Magro",
  "Cerro Azul",
  "Colombo",
  "Contenda",
  "Curitiba",
  "Doutor Ulysses",
  "Fazenda Rio Grande",
  "Itaperuçu",
  "Lapa",
  "Mandirituba",
  "Piên",
  "Pinhais",
  "Piraquara",
  "Quatro Barras",
  "Quitandinha",
  "Rio Branco do Sul",
  "Rio Negro",
  "São José dos Pinhais",
  "Tijucas do Sul",
  "Tunas do Paraná",
] as const;

const RMC_SET = new Set(RMC_MUNICIPALITIES.map(normalizeCity));

/**
 * A UF entra na conta de propósito: existe "Lapa" em SP e "Rio Negro" em SC,
 * e nenhuma das duas é da RMC. Sem checar o estado, o flag sairia errado.
 */
export function isCuritibaMetro(
  city: string | null | undefined,
  state: string | null | undefined,
): boolean {
  if (!city || !state) return false;
  if (state.trim().toUpperCase() !== "PR") return false;
  return RMC_SET.has(normalizeCity(city));
}
