import { Link, useRouterState, type LinkProps } from "@tanstack/react-router";
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Moon,
  Settings,
  Shield,
  Sun,
  Users,
} from "lucide-react";
import { useMemo, type ComponentType, type ReactNode } from "react";
import { ProfileAvatar } from "@/components/common/profile-avatar";
import { NotificationBell } from "@/components/notifications/notification-bell";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { isAdmin, isAdminOrGerente } from "@/utils/permissions";

type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const BASE_NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/avisos", label: "Avisos", icon: Megaphone },
  { to: "/calendario", label: "Calendário", icon: CalendarDays },
  { to: "/tarefas", label: "Agenda", icon: ClipboardList },
  { to: "/projetos", label: "Projetos", icon: FolderKanban },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();
  const { mode, toggleMode } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const displayName = profile?.nome_completo ?? user?.email ?? "Usuário";

  const navItems = useMemo((): NavItem[] => {
    const items: NavItem[] = [...BASE_NAV];
    if (isAdminOrGerente(profile)) {
      items.splice(5, 0, { to: "/equipe", label: "Equipe", icon: Users });
    }
    if (isAdmin(profile)) {
      items.push({ to: "/admin", label: "Admin", icon: Shield });
    }
    return items;
  }, [profile]);

  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="border-b border-sidebar-border">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link to="/dashboard">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <ClipboardList className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">CoreGestor</span>
                    <span className="truncate text-xs text-sidebar-foreground/70">Gestão</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Menu</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map(({ to, label, icon: Icon }) => (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton asChild isActive={isActive(to)} tooltip={label}>
                      <Link to={to as LinkProps["to"]}>
                        <Icon />
                        <span>{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border">
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="flex items-center gap-2 px-2 py-1.5 group-data-[collapsible=icon]:justify-center">
                <ProfileAvatar
                  name={displayName}
                  avatarUrl={profile?.avatar_url}
                  className="h-8 w-8 shrink-0"
                />
                <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-medium">{displayName}</span>
                  <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
                </div>
              </div>
            </SidebarMenuItem>
            <SidebarSeparator className="group-data-[collapsible=icon]:hidden" />
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => signOut()} tooltip="Sair">
                <LogOut />
                <span>Sair</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6">
          <SidebarTrigger className="-ml-1" />
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Button variant="ghost" size="icon" onClick={toggleMode} aria-label="Alternar tema">
              {mode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
