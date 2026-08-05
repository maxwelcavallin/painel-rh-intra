import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { authConfig } from "@/auth.config";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword } from "@/lib/password";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const email = parsed.data.email.trim().toLowerCase();

        const [user] = await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            sector: users.sector,
            passwordHash: users.passwordHash,
            isActive: users.isActive,
          })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        // Sempre gasta o mesmo tempo, exista o usuário ou não — não entrega
        // por timing quais e-mails estão cadastrados.
        const ok = await verifyPassword(
          parsed.data.password,
          user?.passwordHash ?? null,
        );

        if (!ok || !user || !user.isActive) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          sector: user.sector,
        };
      },
    }),
  ],
});
