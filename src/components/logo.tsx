import Image from "next/image";
import Box from "@mui/material/Box";

/**
 * Lockup oficial da 01 Tecnologia.
 *
 * Substituiu o mosaico desenhado em código, que era uma reconstrução lida da
 * arte. Agora são os arquivos reais em `public/`, gerados a partir do
 * `logo.jpg` original: paleta quantizada para limpar o chuvisco de JPEG dos
 * quadrados chapados e 3x de escala, que cobre tela retina no tamanho em que a
 * logo aparece sem virar peso morto (a origem tem 203px — mais escala não
 * inventa detalhe).
 *
 * A ARTE TEM FUNDO BRANCO. Não é JPEG com transparência possível: os quadrados
 * brancos do mosaico encostam na borda de cima, então tornar o branco
 * transparente abriria buracos no próprio desenho. Por isso `tone="dark"`
 * apoia a logo numa placa branca em vez de tentar um negativo — é o que se faz
 * com marca que só existe sobre branco, e fica legível de propósito.
 */

const LOCKUP = { src: "/logo.png", w: 203, h: 92 };
const MARCA = { src: "/logo-mosaico.png", w: 203, h: 75 };

type LogoProps = {
  /** `dark` = fundo escuro (AppBar): ganha placa branca. `light` = fundo claro. */
  tone?: "light" | "dark";
  /** Só o mosaico, sem o wordmark. Usado quando a sidebar está recolhida. */
  iconOnly?: boolean;
  /** Altura da arte em px. A largura sai da proporção original. */
  size?: number;
};

export function Logo({ tone = "light", iconOnly = false, size = 32 }: LogoProps) {
  const arte = iconOnly ? MARCA : LOCKUP;
  const altura = iconOnly ? size : size * 1.35;
  const largura = Math.round((arte.w / arte.h) * altura);

  return (
    <Box
      sx={
        tone === "dark"
          ? {
              display: "inline-flex",
              bgcolor: "common.white",
              borderRadius: 1,
              px: 0.75,
              py: 0.5,
              lineHeight: 0,
            }
          : { display: "inline-flex", lineHeight: 0 }
      }
    >
      <Image
        src={arte.src}
        alt="01 Tecnologia"
        width={largura}
        height={Math.round(altura)}
        priority
        style={{ display: "block", height: "auto" }}
      />
    </Box>
  );
}
