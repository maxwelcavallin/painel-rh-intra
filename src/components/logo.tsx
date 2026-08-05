import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { mosaic, WORDMARK_GRAY } from "@/lib/brand";

/**
 * Lockup da 01 Tecnologia: faixa em mosaico com o wordmark embaixo.
 *
 * Desenhado em código a partir da logo oficial. É uma RECONSTRUÇÃO — a
 * disposição dos tons foi lida da imagem, não extraída do arquivo vetorial.
 * Quando o SVG oficial chegar, jogue em `public/` e troque o mosaico por um
 * `<Image>`: a API deste componente (`tone`, `iconOnly`, `size`) não muda.
 *
 * `tone="dark"` existe porque a AppBar usa `primary.main` como fundo. Em vez
 * de uma segunda arte, o mosaico vira brancos com opacidades diferentes —
 * preserva o desenho do grid sem perder contraste.
 */

type LogoProps = {
  /** `dark` = para fundo escuro (AppBar). `light` = para fundo claro (login, rodapé). */
  tone?: "light" | "dark";
  /** Só o mosaico, sem o wordmark. Usado quando a sidebar está recolhida. */
  iconOnly?: boolean;
  /** Altura da faixa de mosaico em px. O resto do lockup deriva daí. */
  size?: number;
};

/** `"w"` = quadrado branco; `"gray"` = neutro; números = tons do mosaico. */
type Cell = keyof typeof mosaic | "w";

const COLS = 8;
const ROWS = 3;

/**
 * O mosaico da marca: azul à esquerda, esmaecendo para neutro à direita.
 * Lido linha a linha da logo oficial.
 */
const GRID: Cell[] = [
  300, "w", "w", 500, "w", 700, "w", "gray",
  500, "gray", 500, "w", 500, "w", "gray", "gray",
  500, "w", 700, 500, 700, 500, "gray", "gray",
];

/** Opacidades do negativo, na mesma ordem de intensidade dos tons originais. */
const DARK_ALPHA: Record<Cell, number> = {
  w: 0.96,
  100: 0.82,
  300: 0.66,
  500: 0.5,
  700: 0.34,
  gray: 0.22,
};

export function Logo({ tone = "light", iconOnly = false, size = 32 }: LogoProps) {
  const cell = size / ROWS;
  const dark = tone === "dark";

  const colorFor = (key: Cell) =>
    dark
      ? `rgba(255,255,255,${DARK_ALPHA[key]})`
      : key === "w"
        ? "#FFFFFF"
        : mosaic[key];

  return (
    <Box
      sx={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: `${Math.max(2, cell * 0.22)}px`,
        flexShrink: 0,
      }}
    >
      <Box
        aria-hidden
        sx={{
          display: "grid",
          gridTemplateColumns: `repeat(${COLS}, ${cell}px)`,
          gridTemplateRows: `repeat(${ROWS}, ${cell}px)`,
          gap: `${Math.max(1, cell * 0.06)}px`,
        }}
      >
        {GRID.map((key, i) => (
          <Box key={i} sx={{ backgroundColor: colorFor(key) }} />
        ))}
      </Box>

      {!iconOnly && (
        <Typography
          component="span"
          sx={{
            // Acompanha a largura do mosaico em vez de sobrar ou faltar.
            fontSize: cell * 1.22,
            fontWeight: 700,
            letterSpacing: "0.01em",
            lineHeight: 1,
            whiteSpace: "nowrap",
            color: dark ? "common.white" : WORDMARK_GRAY,
          }}
        >
          01 TECNOLOGIA
        </Typography>
      )}
    </Box>
  );
}
