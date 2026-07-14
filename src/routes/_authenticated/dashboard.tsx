import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock,
  Megaphone,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAvisos } from "@/hooks/use-avisos";
import { useProfile } from "@/hooks/use-profile";
import { useDashboardKpis, useRecentTarefas } from "@/hooks/use-tarefas";
import { isAvisoLido } from "@/services/avisos";
import { isAvisoAtivo } from "@/utils/avisos";
import { formatDate } from "@/utils/formatters";
import { TAREFA_PRIORIDADE_COLORS, TAREFA_STATUS_LABELS, formatResponsaveisLabel } from "@/utils/tarefas";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { data: profile } = useProfile();
  const { data: kpis, isLoading, isError } = useDashboardKpis();
  const {
    data: recentTarefas,
    isLoading: loadingRecent,
    isError: errorRecent,
  } = useRecentTarefas(5);
  const { data: avisos, isError: errorAvisos } = useAvisos();

  const avisosNaoLidos = errorAvisos
    ? 0
    : (avisos ?? []).filter((a) => isAvisoAtivo(a) && !isAvisoLido(a, profile?.id)).length;

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
          <Button variant="outline" asChild className="gap-2">
            <Link to="/relatorios">
              <BarChart3 className="h-4 w-4" />
              Relatórios
            </Link>
          </Button>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Próximas tarefas</CardTitle>
              <CardDescription>Tarefas abertas ordenadas por vencimento.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild className="gap-1">
              <Link to="/tarefas">
                Ver todas
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loadingRecent ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-lg" />
                ))}
              </div>
            ) : errorRecent ? (
              <p className="py-4 text-sm text-destructive">
                Não foi possível carregar as próximas tarefas.
              </p>
            ) : !recentTarefas?.length ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <p>Nenhuma tarefa pendente.</p>
                <Button variant="link" asChild className="mt-2">
                  <Link to="/tarefas">Criar tarefa</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentTarefas.map((tarefa) => (
                  <div
                    key={tarefa.id}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{tarefa.titulo}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatResponsaveisLabel(tarefa)}
                        {tarefa.data_vencimento
                          ? ` · ${formatDate(tarefa.data_vencimento)}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          TAREFA_PRIORIDADE_COLORS[tarefa.prioridade] ?? undefined
                        }
                      >
                        {tarefa.prioridade}
                      </Badge>
                      <Badge variant="secondary" className="hidden sm:inline-flex">
                        {TAREFA_STATUS_LABELS[tarefa.status] ?? tarefa.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4" />
                Fase 4 concluída
              </CardTitle>
              <CardDescription>Notificações, relatórios e painel admin implementados.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>✓ Kanban, comentários, subtarefas e avisos</p>
              <p>✓ Notificações (Realtime + polling)</p>
              <p>✓ Relatórios com gráficos</p>
              <p>✓ Painel admin + Edge Function criar-usuario</p>
              <p>○ Calendário, recorrência, anexos e 2FA (Fase 5)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertCircle className="h-4 w-4" />
                Seu perfil
              </CardTitle>
              <CardDescription>Informações da sua conta no sistema.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Nome</span>
                <span className="font-medium text-right">{profile?.nome_completo ?? "—"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Papel</span>
                <span className="font-medium capitalize">{profile?.papel ?? "—"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Setor</span>
                <span className="font-medium text-right">
                  {profile?.setor?.nome ?? "Não definido"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
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
