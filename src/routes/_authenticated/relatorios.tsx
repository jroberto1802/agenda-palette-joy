import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useRelatorios } from "@/hooks/use-relatorios";
import { TAREFA_PRIORIDADE_LABELS, TAREFA_STATUS_LABELS } from "@/utils/tarefas";

export const Route = createFileRoute("/_authenticated/relatorios")({
  component: RelatoriosPage,
});

const statusChartConfig = {
  total: { label: "Tarefas", color: "hsl(var(--primary))" },
} satisfies ChartConfig;

const prioridadeChartConfig = {
  total: { label: "Tarefas", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;

const setorChartConfig = {
  total: { label: "Tarefas", color: "hsl(var(--chart-3))" },
} satisfies ChartConfig;

const linhaChartConfig = {
  total: { label: "Concluídas", color: "hsl(var(--chart-4))" },
} satisfies ChartConfig;

function RelatoriosPage() {
  const { data, isLoading, isError } = useRelatorios();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-destructive">
          Não foi possível carregar os relatórios.
        </CardContent>
      </Card>
    );
  }

  const statusData = data.porStatus.map((s) => ({
    name: TAREFA_STATUS_LABELS[s.status],
    total: s.total,
  }));

  const prioridadeData = data.porPrioridade.map((p) => ({
    name: p.prioridade,
    total: p.total,
  }));

  const setorData = data.porSetor.map((s) => ({
    name: s.nome,
    total: s.total,
    fill: s.cor ?? "hsl(var(--muted-foreground))",
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Relatórios</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão analítica de {data.totalTarefas} tarefas ativas no sistema.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tarefas por status</CardTitle>
            <CardDescription>Distribuição atual do fluxo de trabalho</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={statusChartConfig} className="h-64 w-full">
              <BarChart data={statusData} margin={{ left: 0, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="total" fill="var(--color-total)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tarefas por prioridade</CardTitle>
            <CardDescription>Urgência das demandas abertas</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={prioridadeChartConfig} className="h-64 w-full">
              <BarChart data={prioridadeData} margin={{ left: 0, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  tickFormatter={(v) => TAREFA_PRIORIDADE_LABELS[v as keyof typeof TAREFA_PRIORIDADE_LABELS]?.split("—")[0]?.trim() ?? v}
                />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="total" fill="var(--color-total)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tarefas por setor</CardTitle>
            <CardDescription>Carga de trabalho por área</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={setorChartConfig} className="h-64 w-full">
              <BarChart data={setorData} layout="vertical" margin={{ left: 8, right: 8 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={90} fontSize={12} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="total" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conclusões — últimos 7 dias</CardTitle>
            <CardDescription>Tarefas finalizadas por dia</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={linhaChartConfig} className="h-64 w-full">
              <LineChart data={data.conclusoesPorDia} margin={{ left: 0, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="data" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="var(--color-total)"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {data.porPessoa.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top responsáveis</CardTitle>
            <CardDescription>Tarefas atribuídas por pessoa</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.porPessoa.map((p, i) => (
                <div key={p.usuario_id} className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground w-6">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.nome}</p>
                    <div className="h-2 mt-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{
                          width: `${Math.min(100, (p.total / (data.porPessoa[0]?.total || 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{p.total}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
