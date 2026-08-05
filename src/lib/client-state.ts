"use client";

import { useSyncExternalStore } from "react";

/**
 * Leitura de estado que só existe no navegador, sem quebrar a hidratação.
 *
 * A tentação é `useState(false)` + `useEffect(() => setX(localStorage...))`,
 * mas isso dispara render em cascata e o lint barra com razão. O primitivo do
 * React para "valor que vem de fora do React" é `useSyncExternalStore`: ele
 * recebe um retrato do servidor e outro do cliente, e cuida da troca sozinho.
 */

const ouvintes = new Set<() => void>();

function inscrever(callback: () => void) {
  ouvintes.add(callback);
  return () => {
    ouvintes.delete(callback);
  };
}

function avisarTodos() {
  for (const callback of ouvintes) callback();
}

/**
 * Flag booleana guardada no localStorage.
 *
 * No servidor o retrato é sempre `false` — é o estado neutro para as duas
 * usadas até aqui (menu expandido). Quem precisar de outro padrão passa em
 * `padraoNoServidor`.
 */
export function useLocalFlag(
  chave: string,
  padraoNoServidor = false,
): [boolean, (valor: boolean) => void] {
  const valor = useSyncExternalStore(
    inscrever,
    () => window.localStorage.getItem(chave) === "1",
    () => padraoNoServidor,
  );

  const definir = (novo: boolean) => {
    window.localStorage.setItem(chave, novo ? "1" : "0");
    avisarTodos();
  };

  return [valor, definir];
}

/**
 * `false` no servidor e no primeiro render, `true` depois de hidratar.
 *
 * Serve para adiar a renderização de algo que depende de estado do cliente —
 * como o tema escolhido — sem que servidor e cliente produzam marcações
 * diferentes.
 */
export function useHidratado(): boolean {
  return useSyncExternalStore(
    inscrever,
    () => true,
    () => false,
  );
}
