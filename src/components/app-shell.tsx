"use client";

import { useState } from "react";
import AppBar from "@mui/material/AppBar";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, Menu as MenuIcon } from "lucide-react";

import { Logo } from "@/components/logo";
import type { Role } from "@/db/schema";
import { useLocalFlag } from "@/lib/client-state";
import {
  navFor,
  ROLE_LABEL,
  SECTION_ORDER,
  sectionOf,
  type NavSection,
} from "@/lib/nav";

const DRAWER_WIDTH = 240;
/** Largura recolhida: cabe o ícone centralizado e mais nada. */
const DRAWER_WIDTH_MINI = 64;
const APPBAR_HEIGHT = 56;
const CHAVE_MENU = "menu-recolhido";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AppShell({
  user,
  logout,
  children,
}: {
  user: { name: string; email: string; role: Role };
  logout: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  // A escolha sobrevive ao recarregamento. O retrato do servidor é "expandido",
  // então quem prefere recolhido vê um quadro com o menu aberto — o preço de
  // não haver localStorage no servidor.
  const [recolhido, setRecolhido] = useLocalFlag(CHAVE_MENU);

  const items = navFor(user.role);

  /**
   * Seções recolhíveis. A que contém a tela atual nasce aberta e as outras
   * fechadas — é o que resolve a coluna longa do RH, que via as quatro seções
   * abertas de uma vez.
   *
   * `manual` guarda só o que o usuário clicou; o resto cai no padrão. Não vai
   * para o localStorage de propósito: a cada carregamento o menu volta a se
   * organizar em torno de onde a pessoa está, que é quase sempre o que ela
   * quer. O que persiste é o recolhimento da coluna inteira, esse sim uma
   * preferência de layout.
   */
  const secaoAtiva = sectionOf(pathname);
  const [manual, setManual] = useState<Partial<Record<NavSection, boolean>>>({});

  const estaAberta = (section: NavSection) =>
    manual[section] ?? section === secaoAtiva;

  const alternarSecao = (section: NavSection) =>
    setManual((atual) => ({ ...atual, [section]: !estaAberta(section) }));

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  /**
   * `mini` é parâmetro e não leitura direta do estado: o drawer temporário
   * do celular usa o mesmo conteúdo e ali recolher não faz sentido — a
   * gaveta já é a navegação inteira.
   */
  const conteudoDrawer = (mini: boolean) => (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Toolbar
        sx={{
          minHeight: `${APPBAR_HEIGHT}px !important`,
          px: 2,
          display: { xs: "flex", md: "none" },
        }}
      >
        <Logo size={24} />
      </Toolbar>
      <Divider sx={{ display: { xs: "block", md: "none" } }} />

      <Box sx={{ overflowY: "auto", flex: 1, py: 1 }}>
        {SECTION_ORDER.map((section) => {
          const sectionItems = items.filter((i) => i.section === section);
          if (sectionItems.length === 0) return null;

          // Recolhido não recolhe seção: ali já não há rótulo para clicar, e
          // esconder ícones deixaria a coluna sem nenhuma pista de destino.
          const aberta = mini || estaAberta(section);

          return (
            <List key={section} dense sx={{ py: 0.25 }}>
              {mini ? (
                <Box
                  sx={{
                    borderTop: "1px solid",
                    borderTopColor: "divider",
                    mx: 1.5,
                    my: 1,
                  }}
                />
              ) : (
                <ListItemButton
                  onClick={() => alternarSecao(section)}
                  aria-expanded={aberta}
                  sx={{ mx: 1, borderRadius: 1, py: 0.25 }}
                >
                  <ListItemText
                    primary={section}
                    slotProps={{
                      primary: {
                        sx: {
                          fontSize: 11,
                          fontWeight: 600,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: "text.secondary",
                        },
                      },
                    }}
                  />
                  {/* Um ponto marca a seção que está fechada mas contém a tela
                      aberta — sem ele, navegar para dentro de uma seção que o
                      usuário fechou faria o item ativo sumir sem explicação. */}
                  {!aberta && section === secaoAtiva && (
                    <Box
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        bgcolor: "primary.main",
                        mr: 0.75,
                      }}
                    />
                  )}
                  <ChevronDown
                    size={14}
                    style={{
                      flex: "none",
                      color: "var(--mui-palette-text-secondary)",
                      transform: aberta ? "none" : "rotate(-90deg)",
                      transition: "transform 150ms",
                    }}
                  />
                </ListItemButton>
              )}

              <Collapse in={aberta} timeout="auto" unmountOnExit>
              {sectionItems.map(({ href, label, icon: Icon }) => {
                const active = isActive(href);
                return (
                  <ListItemButton
                    key={href}
                    component={NextLink}
                    href={href}
                    selected={active}
                    onClick={() => setMobileOpen(false)}
                    sx={{
                      mx: 1,
                      borderRadius: 1,
                      ...(mini && { justifyContent: "center", px: 1.25 }),
                      "&.Mui-selected": {
                        bgcolor: "primary.main",
                        color: "primary.contrastText",
                        "&:hover": { bgcolor: "primary.dark" },
                        "& .MuiListItemIcon-root": {
                          color: "primary.contrastText",
                        },
                      },
                    }}
                  >
                    {/* Recolhido, o ícone é a única pista do destino —
                        sem tooltip o menu vira adivinhação. */}
                    <Tooltip title={mini ? label : ""} placement="right" arrow>
                      <ListItemIcon
                        sx={{ minWidth: mini ? 0 : 34, justifyContent: "center" }}
                      >
                        <Icon size={18} />
                      </ListItemIcon>
                    </Tooltip>
                    {!mini && (
                      <ListItemText
                        primary={label}
                        slotProps={{
                          primary: {
                            sx: { fontSize: 14, fontWeight: active ? 600 : 400 },
                          },
                        }}
                      />
                    )}
                  </ListItemButton>
                );
              })}
              </Collapse>
            </List>
          );
        })}
      </Box>

      <Divider />
      <Box
        sx={{
          p: mini ? 1 : 2,
          display: "flex",
          justifyContent: mini ? "center" : "flex-start",
        }}
      >
        <Logo size={mini ? 18 : 26} iconOnly={mini} />
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100dvh" }}>
      <AppBar
        position="fixed"
        sx={{ zIndex: (t) => t.zIndex.drawer + 1, height: APPBAR_HEIGHT }}
      >
        <Toolbar sx={{ minHeight: `${APPBAR_HEIGHT}px !important`, gap: 1.5 }}>
          {/*
            No celular o hambúrguer vem antes de tudo e abre a gaveta
            temporária — é o padrão que o dedo procura no canto.
          */}
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setMobileOpen((v) => !v)}
            sx={{ display: { md: "none" } }}
            aria-label="Abrir menu"
          >
            <MenuIcon size={22} />
          </IconButton>

          {/*
            No desktop é o contrário: a logo vem primeiro e o hambúrguer fecha a
            coluna, encostado na borda da gaveta que ele controla. Assim o botão
            fica em cima do menu, e não empurrando a marca para o meio da barra.
          */}
          <Box
            sx={{
              display: { xs: "none", md: "flex" },
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
              // Desconta o padding do Toolbar para o botão cair exatamente na
              // linha divisória da gaveta.
              width: `calc(${recolhido ? DRAWER_WIDTH_MINI : DRAWER_WIDTH}px - 24px)`,
              transition: (t) =>
                t.transitions.create("width", {
                  easing: t.transitions.easing.sharp,
                  duration: t.transitions.duration.shorter,
                }),
            }}
          >
            {/* Some quando recolhido: em 64px não cabe logo e botão. */}
            {!recolhido && <Logo tone="dark" size={24} />}
            <IconButton
              color="inherit"
              onClick={() => setRecolhido(!recolhido)}
              aria-label={recolhido ? "Expandir menu" : "Recolher menu"}
              sx={{ ml: recolhido ? "auto" : 0, mr: recolhido ? "auto" : 0 }}
            >
              <MenuIcon size={22} />
            </IconButton>
          </Box>

          <Box sx={{ flex: 1 }} />

          <Box sx={{ textAlign: "right", display: { xs: "none", sm: "block" } }}>
            <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.2 }}>
              {user.name}
            </Typography>
            <Typography
              variant="caption"
              // Herda a cor da AppBar em vez de branco fixo: no claro a barra
              // é azul da marca, no escuro é superfície com texto claro.
              sx={{ color: "inherit", opacity: 0.75, lineHeight: 1 }}
            >
              {ROLE_LABEL[user.role]}
            </Typography>
          </Box>

          <IconButton
            onClick={(e) => setMenuAnchor(e.currentTarget)}
            aria-label="Menu do usuário"
          >
            <Avatar
              sx={{
                width: 34,
                height: 34,
                bgcolor: "mosaic.500",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {initials(user.name)}
            </Avatar>
          </IconButton>

          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={() => setMenuAnchor(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {user.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {user.email}
              </Typography>
            </Box>
            <Divider />
            {/* O form envolve o MenuItem: `action` no MenuItem colidiria com a
                prop `action` (ref de imperative handle) do ButtonBase. */}
            <Box component="form" action={logout}>
              <MenuItem
                component="button"
                type="submit"
                sx={{ width: "100%", gap: 1.5, fontSize: 14 }}
              >
                <LogOut size={16} />
                Sair
              </MenuItem>
            </Box>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{
          width: { md: recolhido ? DRAWER_WIDTH_MINI : DRAWER_WIDTH },
          flexShrink: 0,
        }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box" },
          }}
        >
          {conteudoDrawer(false)}
        </Drawer>

        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": {
              width: recolhido ? DRAWER_WIDTH_MINI : DRAWER_WIDTH,
              boxSizing: "border-box",
              borderRight: "1px solid",
              borderColor: "divider",
              overflowX: "hidden",
              transition: (t) =>
                t.transitions.create("width", {
                  easing: t.transitions.easing.sharp,
                  duration: t.transitions.duration.shorter,
                }),
            },
          }}
        >
          <Toolbar sx={{ minHeight: `${APPBAR_HEIGHT}px !important` }} />
          {conteudoDrawer(recolhido)}

        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: {
            md: `calc(100% - ${recolhido ? DRAWER_WIDTH_MINI : DRAWER_WIDTH}px)`,
          },
          bgcolor: "background.default",
          minHeight: "100dvh",
        }}
      >
        <Toolbar sx={{ minHeight: `${APPBAR_HEIGHT}px !important` }} />
        <Box sx={{ p: 3 }}>{children}</Box>
      </Box>
    </Box>
  );
}
