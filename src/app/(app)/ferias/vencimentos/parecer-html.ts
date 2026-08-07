import type { Parecer } from "@/server/parecer";

/**
 * Monta o parecer como página HTML e manda imprimir — é onde o navegador
 * oferece "Salvar como PDF".
 *
 * Roda no cliente, a partir do parecer que JÁ está em memória. Gerar de novo no
 * servidor custaria outra chamada de modelo e, pior, poderia devolver um texto
 * diferente do que está na tela: quem baixa espera o documento que acabou de
 * ler, não uma segunda opinião.
 *
 * Sem dependência de PDF: o Chrome headless na Vercel é notoriamente frágil, e
 * a impressão do próprio navegador resolve o caso com zero infraestrutura.
 */

export type DadosParaImpressao = {
  subtitulo: string | null;
  marcadores: string[];
  parecer: Parecer;
  /** Linha de contexto do rodapé, já montada como texto. */
  rodape: string | null;
};

const RISCO_LABEL = {
  alto: "Risco alto",
  medio: "Risco médio",
  baixo: "Risco baixo",
} as const;

const RISCO_COR = {
  alto: "#b3261e",
  medio: "#8a5a00",
  baixo: "#1b5e20",
} as const;

/**
 * O `<title>` é o nome que o navegador sugere ao salvar em PDF.
 *
 * Barra e acento saem fora: no Windows `/` é separador de caminho e o diálogo
 * de salvar recusa o nome inteiro.
 */
function nomeDoArquivo(subtitulo: string | null, hojeISO: string): string {
  const quem = subtitulo
    ? subtitulo
        .split("·")[0]
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    : "carteira";
  return `parecer-${quem || "colaborador"}-${hojeISO}`;
}

/**
 * Escapa o que vai para o HTML.
 *
 * Não é paranoia: nome, setor e cargo são texto livre digitado pelo RH, e o
 * parecer traz trechos redigidos por modelo. Um `&` ou `<` solto já quebraria a
 * página mesmo sem má intenção.
 */
function esc(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function li(itens: string[]): string {
  return itens.map((i) => `<li>${esc(i)}</li>`).join("");
}

export function montarHtmlDoParecer(d: DadosParaImpressao): string {
  // `sv-SE` dá AAAA-MM-DD, que ordena sozinho na pasta de quem baixa vários.
  const hojeISO = new Date().toLocaleDateString("sv-SE");
  const agora = new Date().toLocaleString("pt-BR");
  const p = d.parecer;

  const acoes = p.acoes
    .map((a, i) => {
      const prazo = a.ateQuando
        ? `<span class="prazo">até ${esc(a.ateQuando)}</span>`
        : "";
      const quem =
        a.quem.length > 0 ? `<div class="quem">${esc(a.quem.join(", "))}</div>` : "";
      return `<li><div class="acao"><span>${i + 1}. ${esc(a.oQue)}</span>${prazo}</div>${quem}</li>`;
    })
    .join("");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${esc(nomeDoArquivo(d.subtitulo, hojeISO))}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    color: #1a1a1a; line-height: 1.55; margin: 0; padding: 32px 28px; max-width: 800px;
  }
  header { border-bottom: 2px solid #1e4d6b; padding-bottom: 14px; margin-bottom: 22px; }
  h1 { font-size: 19px; margin: 0 0 4px; color: #1e4d6b; }
  .sub { font-size: 13px; color: #555; margin: 0; }
  .chips { margin: 0 0 20px; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 6px; }
  .chips li {
    font-size: 11px; border: 1px solid #c4c4c4; border-radius: 999px;
    padding: 3px 10px; color: #444;
  }
  .risco { font-weight: 700; border-color: currentColor; color: ${RISCO_COR[p.risco]}; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: #1e4d6b; margin: 24px 0 8px; }
  .resumo { font-size: 14px; margin: 0; }
  ul.lista { margin: 0; padding-left: 20px; font-size: 13.5px; }
  ul.lista li { margin-bottom: 6px; }
  ol.acoes { margin: 0; padding: 0; list-style: none; font-size: 13.5px; counter-reset: a; }
  ol.acoes > li { margin-bottom: 12px; page-break-inside: avoid; }
  .acao { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
  .prazo {
    font-size: 11px; white-space: nowrap; border: 1px solid #1e4d6b;
    color: #1e4d6b; border-radius: 999px; padding: 2px 9px;
  }
  .quem { font-size: 11.5px; color: #666; padding-left: 18px; margin-top: 2px; }
  footer { margin-top: 28px; border-top: 1px solid #ddd; padding-top: 12px; font-size: 11px; color: #666; }
  .acoes-barra { margin-bottom: 22px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .dica { font-size: 12px; color: #666; }
  button {
    font: inherit; font-size: 13px; cursor: pointer; background: #1e4d6b; color: #fff;
    border: 0; border-radius: 6px; padding: 9px 18px;
  }
  /* Na folha impressa o botão não faz sentido — e o rodapé do navegador já data a página. */
  @media print { .acoes-barra { display: none; } body { padding: 0; } }
</style>
</head>
<body>
  <div class="acoes-barra">
    <button onclick="window.print()">Baixar / imprimir</button>
    <span class="dica">Escolha “Salvar como PDF” no destino da impressão.</span>
  </div>

  <header>
    <h1>Parecer de risco e planejamento</h1>
    ${d.subtitulo ? `<p class="sub">${esc(d.subtitulo)}</p>` : ""}
  </header>

  <ul class="chips">
    <li class="risco">${RISCO_LABEL[p.risco]}</li>
    ${d.marcadores.map((m) => `<li>${esc(m)}</li>`).join("")}
  </ul>

  <p class="resumo">${esc(p.resumo)}</p>

  ${
    p.riscos.length > 0
      ? `<h2>O que está em risco</h2><ul class="lista">${li(p.riscos)}</ul>`
      : ""
  }

  ${
    p.acoes.length > 0
      ? `<h2>Por onde começar</h2><ol class="acoes">${acoes}</ol>`
      : ""
  }

  ${d.rodape ? `<h2>Contexto</h2><p class="resumo">${esc(d.rodape)}</p>` : ""}

  <footer>
    ${
      p.fromModel
        ? "Parecer redigido por IA a partir de números apurados pelo sistema. Prazos e saldos são calculados em código, não pelo modelo — confira antes de comunicar."
        : "IA indisponível no momento: este parecer foi montado direto dos números apurados pelo sistema."
    }
    <br>Gerado em ${esc(agora)} · Intranet RH · 01 Tecnologia · uso interno
  </footer>

  <script>
    // Abre a caixa de impressão sozinho. Se o navegador bloquear, o botão no
    // topo continua ali — por isso ele existe, e não só como enfeite.
    window.addEventListener("load", function () {
      setTimeout(function () { window.print(); }, 150);
    });
  </script>
</body>
</html>`;
}

/**
 * Abre o parecer numa aba nova e dispara a impressão.
 *
 * Precisa ser chamado direto do clique: `window.open` fora de gesto do usuário
 * é bloqueado como popup. Se ainda assim vier bloqueado, devolvemos `false` e
 * quem chamou avisa na tela em vez de falhar em silêncio.
 */
export function baixarParecer(d: DadosParaImpressao): boolean {
  // Blob em vez de `document.write`: aquele é obsoleto e deixa a aba em
  // `about:blank`, o que atrapalha salvar e recarregar. A própria página chama
  // `print()` no `load`, então não dependemos de acertar o tempo daqui.
  const blob = new Blob([montarHtmlDoParecer(d)], {
    type: "text/html;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);

  const aba = window.open(url, "_blank");
  if (!aba) {
    URL.revokeObjectURL(url);
    return false;
  }

  // Revogar na hora cancelaria o carregamento. Um minuto é folga suficiente
  // para a aba abrir, e evita segurar a memória do blob pela sessão toda.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);

  return true;
}
