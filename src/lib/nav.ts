import {
  AlertTriangle,
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

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  section: "Meu espaço" | "Equipe" | "Administração";
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
    href: "/avisos",
    label: "Avisos",
    icon: Megaphone,
    roles: RH_ONLY,
    section: "Administração",
  },
  {
    href: "/comunicacoes",
    label: "Comunicações",
    icon: SlidersHorizontal,
    roles: RH_ONLY,
    section: "Administração",
  },
];

export const SECTION_ORDER = ["Meu espaço", "Equipe", "Administração"] as const;

export function navFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export const ROLE_LABEL: Record<Role, string> = {
  user: "Colaborador",
  gestor: "Gestor",
  admin: "RH (admin master)",
};
