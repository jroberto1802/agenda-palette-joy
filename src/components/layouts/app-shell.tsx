import { Link, useRouterState } from "@tanstack/react-router";

import {

  BarChart3,

  Building2,

  CalendarDays,

  ClipboardList,

  LayoutDashboard,

  LogOut,

  Megaphone,

  Menu,

  Moon,

  Settings,

  Shield,

  Sun,

  Users,

} from "lucide-react";

import { useMemo, useState, type ReactNode } from "react";

import { NotificationBell } from "@/components/notifications/notification-bell";

import { useAuth } from "@/hooks/use-auth";

import { useProfile } from "@/hooks/use-profile";

import { useTheme } from "@/hooks/use-theme";

import { Button } from "@/components/ui/button";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

import { cn } from "@/lib/utils";

import { isAdmin } from "@/utils/permissions";



const BASE_NAV = [

  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },

  { to: "/tarefas", label: "Tarefas", icon: ClipboardList },

  { to: "/calendario", label: "Calendário", icon: CalendarDays },

  { to: "/avisos", label: "Avisos", icon: Megaphone },

  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },

  { to: "/setores", label: "Setores", icon: Building2 },

  { to: "/pessoas", label: "Pessoas", icon: Users },

  { to: "/configuracoes", label: "Configurações", icon: Settings },

] as const;



export function AppShell({ children }: { children: ReactNode }) {

  const { user, signOut } = useAuth();

  const { data: profile } = useProfile();

  const { mode, toggleMode } = useTheme();

  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const [mobileOpen, setMobileOpen] = useState(false);



  const displayName = profile?.nome_completo ?? user?.email ?? "Usuário";



  const navItems = useMemo(() => {

    const items = [...BASE_NAV];

    if (isAdmin(profile)) {

      items.push({ to: "/admin", label: "Admin", icon: Shield });

    }

    return items;

  }, [profile]);



  const nav = (

    <nav className="flex flex-col gap-1">

      {navItems.map(({ to, label, icon: Icon }) => {

        const active = pathname === to || pathname.startsWith(`${to}/`);

        return (

          <Link

            key={to}

            to={to}

            onClick={() => setMobileOpen(false)}

            className={cn(

              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",

              active

                ? "bg-primary text-primary-foreground"

                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",

            )}

          >

            <Icon className="h-4 w-4 shrink-0" />

            {label}

          </Link>

        );

      })}

    </nav>

  );



  return (

    <div className="min-h-screen bg-background">

      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">

        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>

            <SheetTrigger asChild>

              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menu">

                <Menu className="h-5 w-5" />

              </Button>

            </SheetTrigger>

            <SheetContent side="left" className="w-72">

              <SheetHeader>

                <SheetTitle>Agenda</SheetTitle>

              </SheetHeader>

              <div className="mt-6">{nav}</div>

            </SheetContent>

          </Sheet>



          <Link to="/dashboard" className="font-semibold tracking-tight">

            Agenda

          </Link>



          <div className="hidden md:flex items-center gap-1 ml-4">{nav}</div>



          <div className="ml-auto flex items-center gap-2">

            <div className="hidden sm:block text-right mr-2">

              <p className="text-sm font-medium leading-none">{displayName}</p>

              <p className="text-xs text-muted-foreground mt-1">{user?.email}</p>

            </div>

            <NotificationBell />

            <Button variant="ghost" size="icon" onClick={toggleMode} aria-label="Alternar tema">

              {mode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}

            </Button>

            <Button variant="outline" size="sm" onClick={() => signOut()} className="gap-2">

              <LogOut className="h-4 w-4" />

              <span className="hidden sm:inline">Sair</span>

            </Button>

          </div>

        </div>

      </header>



      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>

    </div>

  );

}


