import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  AtSign,
  BarChart3,
  Bell,
  CheckCircle2,
  ClipboardList,
  Clock,
  Info,
  Megaphone,
  Paperclip,
  Users,
} from "lucide-react";
import { Component, useMemo, type ErrorInfo, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAvisos } from "@/hooks/use-avisos";
import {
  useMarkNotificacaoLida,
  useNotificacoes,
} from "@/hooks/use-notificacoes";
import { useProfile } from "@/hooks/use-profile";
import { useDashboardKpis } from "@/hooks/use-tarefas";
import { isAvisoLido } from "@/services/avisos";
import type { AvisoWithRelations, Notificacao } from "@/types";
import { isAvisoAtivo } from "@/utils/avisos";
import { formatDate, formatDateTime } from "@/utils/formatters";
import {
  getNotificacaoIconKind,
  getNotificacaoMensagem,
  getNotificacaoNavigateTarget,
  openNotificationsPanel,
} from "@/utils/notificacoes";
import { canAccessRelatorios } from "@/utils/permissions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

class PanelErrorBoundary extends Component<
  { title: string; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[Dashboard:${this.props.title}]`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <p className="py-4 text-sm text-destructive">
          Não foi possível carregar este painel. Os demais conteúdos do Dashboard seguem
          disponíveis.
        </p>
      );
    }
    return this.props.children;
  }
}

function safeFormatDate(value: string | null | undefined): string {
  try {
    return formatDate(value);
  } catch {
    return "—";
  }
}

function safeFormatDateTime(value: string | null | undefined): string {
  try {
    return formatDateTime(value);
  } catch {
    return "—";
  }
}

function Dashboard() {
  const { data: profile } = useProfile();
  const { data: kpis, isLoading, isError } = useDashboardKpis();
  const { data: avisos, isError: errorAvisos } = useAvisos();

  const avisosNaoLidos = useMemo(() => {
    if (errorAvisos || !Array.isArray(avisos)) return 0;
    try {
      return avisos.filter((a) => {
        try {
          return isAvisoAtivo(a) && !isAvisoLido(a, profile?.id);
        } catch {
          return false;
        }
      }).length;
    } catch {
      return 0;
    }
  }, [avisos, errorAvisos, profile?.id]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Olá, {profile?.nome_completo?.split(" ")[0] ?? "bem-vindo"} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão geral da agenda corporativa — setores, pessoas e tarefas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {canAccessRelatorios(profile) && (
            <Button variant="outline" asChild className="gap-2">
              <Link to="/relatorios">
                <BarChart3 className="h-4 w-4" />
                Relatórios
              </Link>
            </Button>
          )}
          <Button variant="outline" asChild className="gap-2">
            <Link to="/avisos">
              <Megaphone className="h-4 w-4" />
              Avisos
              {avisosNaoLidos > 0 && (
                <Badge variant="default" className="ml-1 h-5 px-1.5 text-xs">
                  {avisosNaoLidos}
                </Badge>
              )}
            </Link>
          </Button>
          <Button asChild className="gap-2">
            <Link to="/tarefas">
              <ClipboardList className="h-4 w-4" />
              Ver tarefas
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">
            Não foi possível carregar os indicadores. Tente atualizar a página.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Total de tarefas"
            value={kpis?.totalTarefas ?? 0}
            description="Tarefas ativas no sistema"
            icon={ClipboardList}
          />
          <KpiCard
            title="A fazer"
            value={kpis?.tarefasAFazer ?? 0}
            description={`${kpis?.tarefasEmAndamento ?? 0} em andamento`}
            icon={Clock}
          />
          <KpiCard
            title="Concluídas"
            value={kpis?.tarefasConcluidas ?? 0}
            description={
              (kpis?.tarefasVencendoHoje ?? 0) > 0
                ? `${kpis?.tarefasVencendoHoje} vencem hoje`
                : "Nenhuma vence hoje"
            }
            icon={CheckCircle2}
            highlight={(kpis?.tarefasVencendoHoje ?? 0) > 0}
          />
          <KpiCard
            title="Equipe"
            value={kpis?.totalPessoas ?? 0}
            description={`${kpis?.totalSetores ?? 0} setores`}
            icon={Users}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
            <div className="min-w-0">
              <CardTitle className="text-base">Notificações não lidas</CardTitle>
              <CardDescription>Pendências recentes da sua caixa de notificações.</CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 gap-1"
              onClick={() => openNotificationsPanel()}
            >
              Ver todas
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <PanelErrorBoundary title="notificacoes">
              <NotificacoesNaoLidasPanel />
            </PanelErrorBoundary>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
            <div className="min-w-0">
              <CardTitle className="text-base">Últimos avisos</CardTitle>
              <CardDescription>Publicações recentes do Quadro de Avisos.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild className="shrink-0 gap-1">
              <Link to="/avisos">
                Ver todos
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <PanelErrorBoundary title="avisos">
              <UltimosAvisosPanel />
            </PanelErrorBoundary>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function NotificacoesNaoLidasPanel() {
  const navigate = useNavigate();
  const { data: notificacoes, isLoading, isError } = useNotificacoes();
  const markLida = useMarkNotificacaoLida();

  const unread = useMemo(() => {
    if (!Array.isArray(notificacoes)) return [];
    return notificacoes.filter((n) => n && n.lida === false).slice(0, 5);
  }, [notificacoes]);

  const handleClick = async (notificacao: Notificacao) => {
    try {
      if (!notificacao.lida) {
        await markLida.mutateAsync(notificacao.id);
      }
      const target = getNotificacaoNavigateTarget(notificacao);
      if (target.search) {
        await navigate({ to: target.to, search: target.search });
      } else {
        await navigate({ to: target.to });
      }
    } catch (error) {
      console.error("[Dashboard] falha ao abrir notificação", error);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p className="py-4 text-sm text-destructive">
        Não foi possível carregar as notificações.
      </p>
    );
  }

  if (!unread.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhuma notificação pendente.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {unread.map((n) => (
        <li key={n.id}>
          <button
            type="button"
            className="flex w-full items-start gap-3 rounded-lg border bg-primary/5 p-3 text-left transition-colors hover:bg-muted/50"
            onClick={() => void handleClick(n)}
          >
            <NotificacaoTypeIcon tipo={n.tipo} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-snug">{getNotificacaoMensagem(n)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {safeFormatDateTime(n.created_at)}
              </p>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function UltimosAvisosPanel() {
  const navigate = useNavigate();
  const { data: avisos, isLoading, isError } = useAvisos();

  const recent = useMemo(() => {
    if (!Array.isArray(avisos)) return [];
    return [...avisos]
      .filter((a): a is AvisoWithRelations => !!a && typeof a.id === "string")
      .sort((a, b) => {
        const ta = Date.parse(a.data_publicacao ?? "") || 0;
        const tb = Date.parse(b.data_publicacao ?? "") || 0;
        return tb - ta;
      })
      .slice(0, 5);
  }, [avisos]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p className="py-4 text-sm text-destructive">Não foi possível carregar os avisos.</p>
    );
  }

  if (!recent.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhum aviso publicado ainda.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {recent.map((aviso) => (
        <li key={aviso.id}>
          <button
            type="button"
            className="flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
            onClick={() => {
              void navigate({
                to: "/avisos",
                search: { avisoId: aviso.id },
              }).catch((error) => {
                console.error("[Dashboard] falha ao abrir aviso", error);
              });
            }}
          >
            <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{aviso.titulo}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {safeFormatDate(aviso.data_publicacao)}
              </p>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function NotificacaoTypeIcon({ tipo }: { tipo: string | null | undefined }) {
  const kind = getNotificacaoIconKind(tipo ?? "sistema");
  const className = "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground";
  if (kind === "aviso") return <Megaphone className={className} />;
  if (kind === "comentario") return <AtSign className={className} />;
  if (kind === "anexo") return <Paperclip className={className} />;
  if (kind === "sistema") return <Info className={className} />;
  return <Bell className={className} />;
}

function KpiCard({
  title,
  value,
  description,
  icon: Icon,
  highlight,
}: {
  title: string;
  value: number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-amber-500/50" : undefined}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${highlight ? "text-amber-500" : "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}
