import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/dal";

import { logoutAction } from "./actions";

/**
 * Layout só monta a casca (AppBar/Sidebar) com os dados da sessão.
 * A checagem aqui NÃO é a proteção da rota: layout não re-renderiza a cada
 * navegação e não impede segmentos filhos de rodarem. Cada página chama o DAL
 * por conta própria — ver `src/lib/dal.ts`.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireSession();

  return (
    <AppShell
      user={{ name: user.name, email: user.email, role: user.role }}
      logout={logoutAction}
    >
      {children}
    </AppShell>
  );
}
