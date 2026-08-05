import type { Metadata, Viewport } from "next";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";

import { Providers } from "@/components/providers";
import { roboto } from "@/lib/fonts";

export const metadata: Metadata = {
  title: {
    default: "Intranet RH — 01 Tecnologia",
    template: "%s · Intranet RH",
  },
  description: "Férias e comunicação interna da 01 Tecnologia.",
  // Ferramenta interna: não deve ser indexada em hipótese nenhuma.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  // Um por esquema: a barra do navegador acompanha o tema escolhido.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#2C5F8A" },
    { media: "(prefers-color-scheme: dark)", color: "#16212C" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={roboto.variable} suppressHydrationWarning>
      <body>
        {/*
          Roda ANTES da hidratação e escreve `data-mui-color-scheme` no <html>.
          Sem ele a página pinta clara e pisca para escura quando o React
          assume — o famoso flash branco. `suppressHydrationWarning` acima é
          consequência disso: o atributo existe no cliente e não no HTML
          gerado no servidor, e o React reclamaria da diferença.
        */}
        <InitColorSchemeScript attribute="data" defaultMode="system" />
        <AppRouterCacheProvider options={{ enableCssLayer: true }}>
          <Providers>{children}</Providers>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
