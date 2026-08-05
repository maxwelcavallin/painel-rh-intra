import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/auth.config";

/**
 * Camada 1 de 2 do modelo "nenhuma rota pública".
 *
 * No Next.js 16 o antigo `middleware.ts` virou `proxy.ts` (runtime Node, sem edge).
 * A própria doc do Next é explícita: proxy é checagem OTIMISTA, não pode ser a
 * única defesa — ele só lê o cookie, nunca o banco. A defesa real é a camada 2,
 * o DAL em `src/lib/dal.ts`, chamado dentro de cada page/action/route handler.
 *
 * A lógica aqui é deny-by-default: tudo é bloqueado, e só o que está
 * explicitamente nesta allowlist escapa. Rota nova nasce protegida por omissão.
 */

const { auth } = NextAuth(authConfig);

/** As ÚNICAS páginas que existem sem sessão. Qualquer adição aqui é decisão de segurança. */
const PUBLIC_PAGES = new Set([
  "/login",
  "/esqueci-senha",
  "/redefinir-senha",
]);

function isAllowlisted(pathname: string): boolean {
  if (PUBLIC_PAGES.has(pathname)) return true;

  // Endpoints do próprio Auth.js (signin/signout/callback/csrf/session).
  if (pathname.startsWith("/api/auth/")) return true;

  // Vercel Cron não manda cookie. A rota se defende sozinha com CRON_SECRET.
  if (pathname.startsWith("/api/cron/")) return true;

  return false;
}

export const proxy = auth((req) => {
  const { pathname, search } = req.nextUrl;
  const isLoggedIn = Boolean(req.auth?.user?.id);

  if (isAllowlisted(pathname)) {
    // Quem já está logado não fica preso na tela de login.
    if (isLoggedIn && pathname === "/login") {
      return NextResponse.redirect(new URL("/", req.nextUrl));
    }
    return NextResponse.next();
  }

  if (isLoggedIn) return NextResponse.next();

  // Route Handler sem sessão responde 401 — redirecionar um fetch para HTML
  // só produziria um erro de parse confuso do outro lado.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.nextUrl);
  // Guarda o destino para devolver a pessoa ao lugar certo depois do login.
  loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
});

export default proxy;

export const config = {
  /**
   * Roda em tudo, menos os assets estáticos do próprio Next e arquivos de
   * `public/`. Para auth, a recomendação da doc é justamente rodar em todas as rotas.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo.jpg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
