import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Home,
  Megaphone,
  Plane,
  Send,
  SlidersHorizontal,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import type { Role } from "@/db/schema";

/**
 * Uma única lista de navegação, filtrada pelo papel da sessão.
 * O DS é explícito: um app só, navegação que muda por papel — não duas sidebars.
 *
 * Isto controla apenas o que APARECE. A permissão de verdade é checada de novo
 * no DAL dentro de cada página; esconder item de menu não é segurança.
 */

/**
 * As seções são o submenu: no shell cada uma recolhe, e só a da tela atual
 * nasce aberta. Por isso elas precisam ser CURTAS — uma seção de oito itens
 * aberta desfaz o ganho de recolher as outras.
 *
 * Foi o que motivou separar "Comunicação" de "Administração": o RH via treze
 * itens numa coluna só, e Administração sozinha tinha cinco. Ao dividir,
 * nenhuma seção passa de cinco, e o RH fechado vê quatro linhas em vez de
 * dezesseis.
 */
export type NavSection =
  | "Meu espaço"
  | "Equipe"
  | "Administração"
  | "Comunicação";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  section: NavSection;
};

const ALL: Role[] = ["user", "gestor", "admin"];
const MANAGEMENT: Role[] = ["gestor", "admin"];
const RH_ONLY: Role[] = ["admin"];

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Início", icon: Home, roles: ALL, section: "Meu espaço" },
  {
    href: "/ferias/solicitar",
    label: "Solicitar férias",
    icon: Send,
    roles: ALL,
    section: "Meu espaço",
  },
  {
    href: "/ferias/minhas",
    label: "Minhas férias",
    icon: Plane,
    roles: ALL,
    section: "Meu espaço",
  },
  {
    href: "/calendario",
    label: "Calendário",
    icon: CalendarDays,
    roles: ALL,
    section: "Meu espaço",
  },
  {
    href: "/formularios",
    label: "Formulários",
    icon: FileText,
    roles: ALL,
    section: "Meu espaço",
  },

  {
    href: "/aprovacoes",
    label: "Aprovações",
    icon: ClipboardList,
    roles: MANAGEMENT,
    section: "Equipe",
  },
  {
    href: "/ferias/vencimentos",
    label: "Vencimento de férias",
    icon: AlertTriangle,
    roles: MANAGEMENT,
    section: "Equipe",
  },
  {
    href: "/formularios/painel",
    label: "Painel de formulários",
    icon: ClipboardCheck,
    roles: MANAGEMENT,
    section: "Equipe",
  },

  {
    href: "/ferias/controle",
    label: "Controle de férias",
    icon: Wallet,
    roles: RH_ONLY,
    section: "Administração",
  },
  {
    href: "/colaboradores",
    label: "Colaboradores",
    icon: Users,
    roles: RH_ONLY,
    section: "Administração",
  },
  {
    href: "/eventos",
    label: "Eventos institucionais",
    icon: CalendarClock,
    roles: RH_ONLY,
    section: "Administração",
  },

  {
    href: "/avisos",
    label: "Avisos",
    icon: Megaphone,
    roles: RH_ONLY,
    section: "Comunicação",
  },
  {
    href: "/comunicacoes",
    label: "Canais e notificações",
    icon: SlidersHorizontal,
    roles: RH_ONLY,
    section: "Comunicação",
  },
];

export const SECTION_ORDER: readonly NavSection[] = [
  "Meu espaço",
  "Equipe",
  "Administração",
  "Comunicação",
];

/** A seção a que uma rota pertence — o shell usa para abrir a certa. */
export function sectionOf(pathname: string): NavSection | null {
  // Mais específico primeiro: "/ferias/vencimentos" não pode casar com
  // "/ferias/solicitar" nem vice-versa, e "/" casaria com tudo.
  const match = [...NAV_ITEMS]
    .filter((i) => (i.href === "/" ? pathname === "/" : pathname.startsWith(i.href)))
    .sort((a, b) => b.href.length - a.href.length)[0];

  return match?.section ?? null;
}

export function navFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export const ROLE_LABEL: Record<Role, string> = {
  user: "Colaborador",
  gestor: "Gestor",
  admin: "RH (admin master)",
};
