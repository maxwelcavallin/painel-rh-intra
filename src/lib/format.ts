/**
 * Máscaras, validação e — o mais importante — MASCARAMENTO de dado sensível.
 *
 * Regra de segurança do projeto: CPF e RG nunca aparecem em log, nunca vão em
 * query string, e fora da tela de edição aparecem mascarados. As funções
 * `maskCpf`/`maskRg` existem para que isso seja fácil de fazer certo.
 *
 * Puro, sem banco e sem rede.
 */

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/* ------------------------------------------------------------------ */
/* CPF                                                                 */
/* ------------------------------------------------------------------ */

export function formatCpf(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length !== 11) return value;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/**
 * Valida os dois dígitos verificadores.
 * Rejeita também os repetidos (000…, 111…), que passam no cálculo mas não existem.
 */
export function isValidCpf(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;

  const digit = (slice: number) => {
    let sum = 0;
    for (let i = 0; i < slice; i++) {
      sum += Number(d[i]) * (slice + 1 - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return digit(9) === Number(d[9]) && digit(10) === Number(d[10]);
}

/** `529.982.247-25` → `***.***.247-25`. Só os 5 últimos ficam visíveis. */
export function maskCpf(value: string | null | undefined): string {
  if (!value) return "—";
  const d = onlyDigits(value);
  if (d.length !== 11) return "—";
  return `***.***.${d.slice(6, 9)}-${d.slice(9)}`;
}

/* ------------------------------------------------------------------ */
/* RG                                                                  */
/* ------------------------------------------------------------------ */

/** Mostra só os 3 últimos caracteres; o RG não tem formato único no Brasil. */
export function maskRg(value: string | null | undefined): string {
  if (!value) return "—";
  const clean = value.trim();
  // RGs curtos revelariam quase tudo com "***" + últimos 3; escondemos por completo.
  if (clean.length <= 6) return "***";
  return `${"*".repeat(clean.length - 3)}${clean.slice(-3)}`;
}

/* ------------------------------------------------------------------ */
/* CEP e telefone                                                      */
/* ------------------------------------------------------------------ */

export function formatCep(value: string): string {
  const d = onlyDigits(value).slice(0, 8);
  if (d.length !== 8) return value;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function isValidCep(value: string): boolean {
  return onlyDigits(value).length === 8;
}

/** `41999998888` → `(41) 99999-8888`. Aceita fixo (10) e celular (11). */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return "—";
  const d = onlyDigits(value).replace(/^55/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return value;
}

/* ------------------------------------------------------------------ */
/* Datas                                                               */
/* ------------------------------------------------------------------ */

/** ISO `YYYY-MM-DD` → `DD/MM/YYYY`. Vazio vira travessão. */
export function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "—";
  return `${d}/${m}/${y}`;
}

/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Escapa uma célula de CSV que será aberta no Excel/LibreOffice.
 *
 * `"` viram `""` (padrão CSV) e o campo é envolvido em aspas. Além disso,
 * se o valor começa com `=`, `+`, `-`, `@` ou tab, prefixamos com apóstrofo
 * — sem essa proteção o Excel avalia o conteúdo como fórmula MESMO dentro de
 * aspas (as aspas envolventes são removidas antes da avaliação). Um nome
 * como `=SUM(A:A)` ou `=cmd|'/c calc'!A1` (Windows) executa no destino.
 */
export function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  const safe = /^[=+\-@\t]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}
