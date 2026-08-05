import {
  addMonths,
  endOfMonth,
  format,
  isSameDay,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, ListTodo } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  SubtarefaRecorrenciaBadge,
  TarefaRecorrenciaBadge,
} from "@/components/tarefas/recorrencia-ocorrencia-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/hooks/use-profile";
import { useSubtarefasAgenda, useTarefasCalendario } from "@/hooks/use-tarefas";
import {
  listPrevisoesOcorrencia,
  type PrevisaoOcorrencia,
  type PrevisaoSubtarefa,
} from "@/services/tarefa-recorrencia";
import type { SubtarefaAgendaItem, TarefaWithRelations } from "@/types";
import { toLocalDateKey, hasExplicitTime } from "@/utils/agenda-datas";
import { isSerieModelo } from "@/utils/recorrencia";
import { TAREFA_PRIORIDADE_COLORS, formatResponsaveisLabel } from "@/utils/tarefas";
import { cn } from "@/lib/utils";

type TimelineEntry =
  | { kind: "tarefa"; tarefa: TarefaWithRelations }
  | { kind: "subtarefa"; subtarefa: SubtarefaAgendaItem }
  | { kind: "previsao"; previsao: PrevisaoOcorrencia }
  | { kind: "previsao_subtarefa"; previsao: PrevisaoSubtarefa };

export function TarefaCalendarioView({
  onSelectTarefa,
  onSelectSubtarefa,
}: {
  onSelectTarefa: (id: string) => void;
  onSelectSubtarefa?: (subtarefa: SubtarefaAgendaItem) => void;
}) {
  const { data: profile } = useProfile();
  const [mesAtual, setMesAtual] = useState(() => startOfMonth(new Date()));
  const [diaSelecionado, setDiaSelecionado] = useState<Date>(() => new Date());

  const inicio = startOfMonth(mesAtual).toISOString();
  const fim = endOfMonth(mesAtual).toISOString();
  const rangeDe = toLocalDateKey(startOfMonth(mesAtual))!;
  const rangeAte = toLocalDateKey(endOfMonth(mesAtual))!;

  const { data: tarefasRaw, isLoading } = useTarefasCalendario(inicio, fim);
  const tarefas = useMemo(
    () => (tarefasRaw ?? []).filter((t) => !isSerieModelo(t)),
    [tarefasRaw],
  );

  const { data: subtarefas, isLoading: loadingSubtarefas } = useSubtarefasAgenda(
    {
      usuario_id: profile?.id ?? "",
      data_inicio_de: rangeDe,
      data_inicio_ate: rangeAte,
    },
    { enabled: !!profile?.id },
  );

  const { data: previsoesBundle, isLoading: loadingPrevisoes } = useQuery({
    queryKey: ["recorrencia-previsoes", rangeDe, rangeAte],
    queryFn: () => listPrevisoesOcorrencia(rangeDe, rangeAte),
  });

  const diasComTarefas = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tarefas ?? []) {
      if (!t.data_inicio) continue;
      const key = format(parseISO(t.data_inicio), "yyyy-MM-dd");
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    for (const s of subtarefas ?? []) {
      const key = toLocalDateKey(s.data_inicio);
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    for (const p of previsoesBundle?.tarefas ?? []) {
      const key = toLocalDateKey(p.data_inicio);
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    for (const p of previsoesBundle?.subtarefas ?? []) {
      const key = toLocalDateKey(p.data_inicio);
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [tarefas, subtarefas, previsoesBundle]);

  const itensDoDia = useMemo((): TimelineEntry[] => {
    const reais: TimelineEntry[] = (tarefas ?? [])
      .filter((t) => t.data_inicio && isSameDay(parseISO(t.data_inicio), diaSelecionado))
      .map((tarefa) => ({ kind: "tarefa" as const, tarefa }));

    const subs: TimelineEntry[] = (subtarefas ?? [])
      .filter((s) => s.data_inicio && isSameDay(parseISO(s.data_inicio), diaSelecionado))
      .map((subtarefa) => ({ kind: "subtarefa" as const, subtarefa }));

    const ghosts: TimelineEntry[] = (previsoesBundle?.tarefas ?? [])
      .filter((p) => p.data_inicio && isSameDay(parseISO(p.data_inicio), diaSelecionado))
      .map((previsao) => ({ kind: "previsao" as const, previsao }));

    const ghostSubs: TimelineEntry[] = (previsoesBundle?.subtarefas ?? [])
      .filter((p) => p.data_inicio && isSameDay(parseISO(p.data_inicio), diaSelecionado))
      .map((previsao) => ({ kind: "previsao_subtarefa" as const, previsao }));

    return [...reais, ...subs, ...ghosts, ...ghostSubs];
  }, [tarefas, subtarefas, previsoesBundle, diaSelecionado]);

  const modifiers = useMemo(
    () => ({
      hasTasks: (date: Date) => diasComTarefas.has(format(date, "yyyy-MM-dd")),
    }),
    [diasComTarefas],
  );

  const modifiersClassNames = {
    hasTasks:
      "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary",
  };

  const loading = isLoading || loadingPrevisoes || loadingSubtarefas;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base capitalize">
            {format(mesAtual, "MMMM yyyy", { locale: ptBR })}
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setMesAtual((m) => subMonths(m, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setMesAtual((m) => addMonths(m, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <Calendar
              mode="single"
              selected={diaSelecionado}
              onSelect={(d) => d && setDiaSelecionado(d)}
              month={mesAtual}
              onMonthChange={setMesAtual}
              locale={ptBR}
              modifiers={modifiers}
              modifiersClassNames={modifiersClassNames}
              className="w-full"
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Timeline — {format(diaSelecionado, "dd 'de' MMMM", { locale: ptBR })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : itensDoDia.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma tarefa com data neste dia.</p>
          ) : (
            <div className="space-y-3">
              {itensDoDia.map((item) => {
                if (item.kind === "tarefa") {
                  return (
                    <TimelineItem
                      key={item.tarefa.id}
                      tarefa={item.tarefa}
                      onClick={() => onSelectTarefa(item.tarefa.id)}
                    />
                  );
                }
                if (item.kind === "subtarefa") {
                  return (
                    <SubtarefaTimelineItem
                      key={item.subtarefa.id}
                      subtarefa={item.subtarefa}
                      onClick={() => onSelectSubtarefa?.(item.subtarefa)}
                    />
                  );
                }
                if (item.kind === "previsao") {
                  return (
                    <PrevisaoTimelineItem
                      key={`previsao-${item.previsao.serie_raiz_id}-${item.previsao.data_inicio}`}
                      previsao={item.previsao}
                    />
                  );
                }
                return (
                  <PrevisaoSubtarefaTimelineItem
                    key={`previsao-sub-${item.previsao.serie_raiz_id}-${item.previsao.modelo_subtarefa_id}-${item.previsao.data_inicio}`}
                    previsao={item.previsao}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TimelineItem({
  tarefa,
  onClick,
}: {
  tarefa: TarefaWithRelations;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border p-4 text-left transition-colors hover:bg-accent/50"
    >
      <div className="mb-2 flex flex-wrap gap-2">
        <Badge variant="outline" className={TAREFA_PRIORIDADE_COLORS[tarefa.prioridade]}>
          {tarefa.prioridade}
        </Badge>
        <TarefaRecorrenciaBadge tarefa={tarefa} />
        {tarefa.setor && (
          <Badge variant="outline" style={{ borderColor: tarefa.setor.cor ?? undefined }}>
            {tarefa.setor.nome}
          </Badge>
        )}
      </div>
      <p className="font-medium">{tarefa.titulo}</p>
      {formatResponsaveisLabel(tarefa) !== "Sem responsável" && (
        <p className="mt-1 text-xs text-muted-foreground">
          Responsável: {formatResponsaveisLabel(tarefa)}
        </p>
      )}
      {tarefa.data_inicio && hasExplicitTime(new Date(tarefa.data_inicio)) && (
        <p className="text-xs text-muted-foreground">
          {format(parseISO(tarefa.data_inicio), "HH:mm", { locale: ptBR })}
        </p>
      )}
    </button>
  );
}

function SubtarefaTimelineItem({
  subtarefa,
  onClick,
}: {
  subtarefa: SubtarefaAgendaItem;
  onClick?: () => void;
}) {
  const parentTitle = subtarefa.tarefa?.titulo?.trim() || "Tarefa principal";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "w-full rounded-lg border border-l-4 p-4 text-left transition-colors",
        onClick && "hover:bg-accent/50",
        !onClick && "cursor-default",
      )}
    >
      <div className="mb-2 flex flex-wrap gap-2">
        <Badge variant="secondary" className="gap-1 text-[10px]">
          <ListTodo className="h-3 w-3" />
          Subtarefa
        </Badge>
        <Badge variant="outline" className={TAREFA_PRIORIDADE_COLORS[subtarefa.prioridade]}>
          {subtarefa.prioridade}
        </Badge>
        <SubtarefaRecorrenciaBadge subtarefa={subtarefa} />
      </div>
      <p className="font-medium">{subtarefa.titulo}</p>
      <p className="mt-1 text-xs text-muted-foreground">de: {parentTitle}</p>
    </button>
  );
}

function PrevisaoTimelineItem({ previsao }: { previsao: PrevisaoOcorrencia }) {
  return (
    <div className="w-full rounded-lg border border-dashed p-4 text-left opacity-80">
      <div className="mb-2 flex flex-wrap gap-2">
        <Badge variant="outline" className={TAREFA_PRIORIDADE_COLORS[previsao.prioridade]}>
          {previsao.prioridade}
        </Badge>
        {previsao.setor && (
          <Badge variant="outline" style={{ borderColor: previsao.setor.cor ?? undefined }}>
            {previsao.setor.nome}
          </Badge>
        )}
        <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
          Previsão
        </Badge>
      </div>
      <p className="font-medium text-muted-foreground">{previsao.titulo}</p>
      <p className="mt-1 text-xs text-muted-foreground">Ocorrência ainda não materializada</p>
    </div>
  );
}

function PrevisaoSubtarefaTimelineItem({ previsao }: { previsao: PrevisaoSubtarefa }) {
  return (
    <div className="w-full rounded-lg border border-dashed p-4 text-left opacity-80">
      <div className="mb-2 flex flex-wrap gap-2">
        <Badge variant="secondary" className="gap-1 text-[10px]">
          <ListTodo className="h-3 w-3" />
          Subtarefa
        </Badge>
        <Badge variant="outline" className={TAREFA_PRIORIDADE_COLORS[previsao.prioridade]}>
          {previsao.prioridade}
        </Badge>
        <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
          Previsão
        </Badge>
      </div>
      <p className="font-medium text-muted-foreground">{previsao.titulo}</p>
      <p className="mt-1 text-xs text-muted-foreground">de: {previsao.tarefa_titulo}</p>
    </div>
  );
}
