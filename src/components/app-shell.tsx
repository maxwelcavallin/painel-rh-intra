"use client";

import { useState } from "react";
import AppBar from "@mui/material/AppBar";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu as MenuIcon } from "lucide-react";

import { Logo } from "@/components/logo";
import type { Role } from "@/db/schema";
import { navFor, ROLE_LABEL, SECTION_ORDER } from "@/lib/nav";

const DRAWER_WIDTH = 240;
const APPBAR_HEIGHT = 56;

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

  const items = navFor(user.role);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const drawerContent = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Toolbar
        sx={{
          minHeight: `${APPBAR_HEIGHT}px !important`,
          px: 2,
          display: { xs: "flex", md: "none" },
        }}
      >
        <Logo size={30} />
      </Toolbar>
      <Divider sx={{ display: { xs: "block", md: "none" } }} />

      <Box sx={{ overflowY: "auto", flex: 1, py: 1 }}>
        {SECTION_ORDER.map((section) => {
          const sectionItems = items.filter((i) => i.section === section);
          if (sectionItems.length === 0) return null;

          return (
            <List
              key={section}
              dense
              subheader={
                <ListSubheader
                  disableSticky
                  sx={{
                    bgcolor: "transparent",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "text.secondary",
                    lineHeight: 2.5,
                  }}
                >
                  {section}
                </ListSubheader>
              }
            >
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
                    <ListItemIcon sx={{ minWidth: 34 }}>
                      <Icon size={18} />
                    </ListItemIcon>
                    <ListItemText
                      primary={label}
                      slotProps={{
                        primary: {
                          sx: { fontSize: 14, fontWeight: active ? 600 : 400 },
                        },
                      }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          );
        })}
      </Box>

      <Divider />
      <Box sx={{ p: 2 }}>
        <Logo size={26} />
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
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setMobileOpen((v) => !v)}
            sx={{ display: { md: "none" } }}
            aria-label="Abrir menu"
          >
            <MenuIcon size={22} />
          </IconButton>

          {/* Versão em negativo do lockup — a AppBar tem fundo escuro. */}
          <Box sx={{ display: { xs: "none", md: "block" } }}>
            <Logo tone="dark" size={30} />
          </Box>

          <Box sx={{ flex: 1 }} />

          <Box sx={{ textAlign: "right", display: { xs: "none", sm: "block" } }}>
            <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.2 }}>
              {user.name}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: "rgba(255,255,255,0.75)", lineHeight: 1 }}
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

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: 0 }}>
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
          {drawerContent}
        </Drawer>

        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": {
              width: DRAWER_WIDTH,
              boxSizing: "border-box",
              borderRight: "1px solid",
              borderColor: "divider",
            },
          }}
        >
          <Toolbar sx={{ minHeight: `${APPBAR_HEIGHT}px !important` }} />
          {drawerContent}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
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
