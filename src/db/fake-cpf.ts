/**
 * Completa uma base de 9 dígitos com os dois verificadores corretos.
 *
 * Escrever CPF fictício à mão não funciona: o formulário de cadastro valida o
 * dígito verificador, então um CPF "de mentira" mal formado trava a edição do
 * próprio registro. Calculando aqui, o dado fictício continua fictício mas
 * passa na mesma validação que um real.
 *
 * Usado só por scripts de carga (seed e cadastro de equipe) — nunca em runtime.
 */
export function cpfFicticio(base9: string): string {
  const digits = base9.split("").map(Number);

  const checkDigit = (slice: number[]) => {
    const weightStart = slice.length + 1;
    const sum = slice.reduce((acc, d, i) => acc + d * (weightStart - i), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  const d1 = checkDigit(digits);
  const d2 = checkDigit([...digits, d1]);
  const full = `${base9}${d1}${d2}`;

  return `${full.slice(0, 3)}.${full.slice(3, 6)}.${full.slice(6, 9)}-${full.slice(9)}`;
}
