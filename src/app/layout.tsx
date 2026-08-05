import type { Metadata, Viewport } from "next";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";

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
  themeColor: "#2C5F8A",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={roboto.variable}>
      <body>
        <AppRouterCacheProvider options={{ enableCssLayer: true }}>
          <Providers>{children}</Providers>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
