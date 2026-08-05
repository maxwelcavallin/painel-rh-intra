import type { NextAuthConfig } from "next-auth";
// Import obrigatório para poder augmentar o módulo mais abaixo.
import type { JWT } from "next-auth/jwt";

import type { Role } from "@/db/schema";

/**
 * Config compartilhada entre o app e o proxy.
 * NÃO importa banco nem bcrypt de propósito: o proxy roda em toda requisição,
 * e o `authorize` (único ponto que toca o banco) vive só em `auth.ts`.
 */
export const authConfig = {
  providers: [],
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/login", error: "/login" },
  trustHost: true,
  callbacks: {
    jwt({ token, user }): JWT {
      // `user` só vem preenchido no login. Depois disso o token se sustenta sozinho.
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.sector = user.sector ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id) {
        session.user.id = token.id;
        session.user.role = token.role ?? "user";
        session.user.sector = token.sector ?? null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

declare module "next-auth" {
  interface User {
    role?: Role;
    sector?: string | null;
  }
  interface Session {
    user: {
      id: string;
      role: Role;
      sector: string | null;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    sector?: string | null;
  }
}
