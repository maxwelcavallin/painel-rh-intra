import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { mosaic } from "@/lib/brand";

/**
 * Lockup da 01 Tecnologia desenhado em código (mosaico + wordmark).
 *
 * O plano apontava como pendência de asset a falta de uma versão em negativo
 * para fundo escuro (a AppBar usa `primary.main`). Resolvido aqui com a prop
 * `tone`: em `light` o mosaico usa a paleta original; em `dark` usa brancos com
 * opacidade, preservando o desenho do grid sem perder contraste.
 *
 * Trocar por SVG oficial quando o arquivo chegar — a API do componente não muda.
 */

type LogoProps = {
  /** `dark` = para fundo escuro (AppBar). `light` = para fundo claro (login, rodapé). */
  tone?: "light" | "dark";
  /** Só o mosaico, sem o wordmark. Usado quando a sidebar está recolhida. */
  iconOnly?: boolean;
  size?: number;
};

/** Grid 3x3 da logo. `null` = quadrado "vazio" (cinza neutro). */
const GRID: (keyof typeof mosaic | null)[] = [
  500, 100, 300,
  100, 700, null,
  300, null, 500,
] as (keyof typeof mosaic | null)[];

export function Logo({ tone = "light", iconOnly = false, size = 32 }: LogoProps) {
  const cell = size / 3;

  const colorFor = (key: (typeof GRID)[number]) => {
    if (tone === "dark") {
      if (key === null) return "rgba(255,255,255,0.22)";
      const alpha = { 100: 0.95, 300: 0.75, 500: 0.6, 700: 0.45, gray: 0.25 };
      return `rgba(255,255,255,${alpha[key] ?? 0.6})`;
    }
    return key === null ? mosaic.gray : mosaic[key];
  };

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
      <Box
        aria-hidden
        sx={{
          display: "grid",
          gridTemplateColumns: `repeat(3, ${cell}px)`,
          gridTemplateRows: `repeat(3, ${cell}px)`,
          gap: "1.5px",
          flexShrink: 0,
        }}
      >
        {GRID.map((key, i) => (
          <Box
            key={i}
            sx={{ backgroundColor: colorFor(key), borderRadius: "1px" }}
          />
        ))}
      </Box>

      {!iconOnly && (
        <Box sx={{ lineHeight: 1 }}>
          <Typography
            component="span"
            sx={{
              display: "block",
              fontSize: size * 0.62,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: 1,
              color: tone === "dark" ? "common.white" : "primary.main",
            }}
          >
            01
          </Typography>
          <Typography
            component="span"
            sx={{
              display: "block",
              fontSize: size * 0.26,
              fontWeight: 500,
              letterSpacing: "0.18em",
              lineHeight: 1.2,
              color: tone === "dark" ? "rgba(255,255,255,0.85)" : "text.secondary",
            }}
          >
            TECNOLOGIA
          </Typography>
        </Box>
      )}
    </Box>
  );
}
