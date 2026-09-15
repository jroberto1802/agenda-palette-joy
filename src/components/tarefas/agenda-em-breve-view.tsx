import { addDays, format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { startTransition, useEffect, useMemo, useState } from "react";
import { DescricaoPreview } from "@/components/tarefas/descricao-preview";
import { TarefaRecorrenciaBadge } from "@/components/tarefas/recorrencia-ocorrencia-badge";
import { SubtarefaAgendaCard } from "@/components/tarefas/subtarefa-agenda-item";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useSubtarefasAgenda, useTarefas } from "@/hooks/use-tarefas";
import { cn } from "@/lib/utils";
import type { SubtarefaAgendaItem, TarefaWithRelations } from "@/types";
import {
  CLASSIFICAR_OPTIONS_HOJE_EM_BREVE,
  normalizeTarefaClassificar,
  readAgendaClassificarPreference,
  TAREFA_CLASSIFICAR_HINTS,
  TAREFA_CLASSIFICAR_LABELS,
  writeAgendaClassificarPreference,
  type TarefaClassificar,
} from "@/utils/agenda-classificar-preference";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AGENDA_EM_BREVE_PAGE_SIZE,
  getEmBreveDays,
  resolveWindowStartForMonth,
  startOfTodayLocal,
  toLocalDateKey,
} from "@/utils/agenda-datas";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { listPrevisoesOcorrencia, type PrevisaoOcorrencia, type PrevisaoSubtarefa } from "@/services/tarefa-recorrencia";
import { compareByClassificar, TAREFA_PRIORIDADE_BAND_CLASS } from "@/utils/tarefas";
import { isSerieModelo } from "@/utils/recorrencia";

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, monthIndex) => ({
  value: String(monthIndex),
  label: format(new Date(2020, monthIndex, 1), "MMMM", { locale: ptBR }),
}));

const YEAR_OPTIONS_START = 2026;
const YEAR_OPTIONS_FORWARD = 6;

function buildYearOptions(): number[] {
  return Array.from(
    { length: YEAR_OPTIONS_FORWARD + 1 },
    (_, i) => YEAR_OPTIONS_START + i,
  );
}

function emBreveRangeKey(start: Date): { de: string; ate: string } {
  const days = getEmBreveDays(start, AGENDA_EM_BREVE_PAGE_SIZE);
  return {
    de: toLocalDateKey(days[0])!,
    ate: toLocalDateKey(days[days.length - 1])!,
  };
}

type EmBreveItem =
  | { kind: "tarefa"; tarefa: TarefaWithRelations }
  | { kind: "subtarefa"; subtarefa: SubtarefaAgendaItem }
  | { kind: "previsao"; previsao: PrevisaoOcorrencia }
  | { kind: "previsao_subtarefa"; previsao: PrevisaoSubtarefa };

function EmBrevePrevisaoCard({ previsao }: { previsao: PrevisaoOcorrencia }) {
  return (
    <div
      className={cn(
        "w-full rounded-lg border border-dashed border-l-4 bg-muted/30 px-3 py-2 text-left opacity-80",
        TAREFA_PRIORIDADE_BAND_CLASS[previsao.prioridade],
      )}
    >
      <p className="line-clamp-2 text-sm font-medium leading-snug text-muted-foreground">
        {previsao.titulo}
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        Previsão · recorrência
      </p>
    </div>
  );
}

function EmBrevePrevisaoSubtarefaCard({ previsao }: { previsao: PrevisaoSubtarefa }) {
  return (
    <div
      className={cn(
        "w-full rounded-md border border-dashed border-l-4 bg-muted/30 px-2 py-1.5 text-left opacity-80",
        TAREFA_PRIORIDADE_BAND_CLASS[previsao.prioridade],
      )}
    >
      <p className="line-clamp-2 text-xs font-medium leading-snug text-muted-foreground">
        {previsao.titulo}
      </p>
      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
        de: {previsao.tarefa_titulo}
      </p>
      <p className="mt-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
        Previsão · subtarefa
      </p>
    </div>
  );
}

function EmBreveTaskCard({
  tarefa,
  onOpen,
}: {
  tarefa: TarefaWithRelations;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "w-full rounded-lg border border-l-4 bg-card px-3 py-2.5 text-left shadow-sm transition-colors hover:bg-muted/40",
        TAREFA_PRIORIDADE_BAND_CLASS[tarefa.prioridade],
      )}
    >
      <p className="line-clamp-2 text-sm font-medium leading-snug">{tarefa.titulo}</p>
      <DescricaoPreview
        descricao={tarefa.descricao}
        className="mt-0.5 line-clamp-1 text-xs leading-snug text-muted-foreground"
      />
      <div className="mt-1.5 flex flex-wrap gap-1">
        <TarefaRecorrenciaBadge tarefa={tarefa} />
        {tarefa.setor && (
          <Badge
            variant="outline"
            className="px-1.5 py-0 text-[10px]"
            style={{
              borderColor: tarefa.setor.cor ?? undefined,
              color: tarefa.setor.cor ?? undefined,
            }}
          >
            {tarefa.setor.nome}
          </Badge>
        )}
        {tarefa.projeto && (
          <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
            {tarefa.projeto.nome}
          </Badge>
        )}
      </div>
    </button>
  );
}

export function AgendaEmBreveView({
  usuarioId,
  onOpenTarefa,
  onOpenSubtarefa,
  onCreateForDate,
}: {
  usuarioId: string | undefined;
  onOpenTarefa: (tarefa: TarefaWithRelations) => void;
  onOpenSubtarefa: (subtarefa: SubtarefaAgendaItem) => void;
  onCreateForDate: (date: Date) => void;
}) {
  const queryClient = useQueryClient();
  const [windowStart, setWindowStart] = useState(() => startOfTodayLocal());
  const [classificar, setClassificar] = useState<TarefaClassificar>("prioridade_hora");

  useEffect(() => {
    if (!usuarioId) return;
    setClassificar(readAgendaClassificarPreference(usuarioId, "agenda-em-breve"));
  }, [usuarioId]);

  const handleClassificarChange = (value: TarefaClassificar) => {
    const next = normalizeTarefaClassificar(value, "agenda-em-breve");
    setClassificar(next);
    writeAgendaClassificarPreference(usuarioId, "agenda-em-breve", next);
  };

  const days = useMemo(
    () => getEmBreveDays(windowStart, AGENDA_EM_BREVE_PAGE_SIZE),
    [windowStart],
  );

  const rangeDe = toLocalDateKey(days[0])!;
  const rangeAte = toLocalDateKey(days[days.length - 1])!;
  const todayKey = useMemo(() => toLocalDateKey(startOfTodayLocal())!, []);

  const { data: tarefas, isLoading: loadingTarefas } = useTarefas(
    {
      atribuido_ids: usuarioId ? [usuarioId] : [],
      data_inicio_de: rangeDe,
      data_inicio_ate: rangeAte,
      lite: true,
    },
    { enabled: !!usuarioId },
  );

  const { data: subtarefas, isLoading: loadingSubtarefas } = useSubtarefasAgenda(
    {
      usuario_id: usuarioId ?? "",
      data_inicio_de: rangeDe,
      data_inicio_ate: rangeAte,
      lite: true,
    },
    { enabled: !!usuarioId },
  );

  const {
    data: previsoesBundle,
    isLoading: loadingPrevisoes,
    isFetching: fetchingPrevisoes,
  } = useQuery({
    queryKey: ["recorrencia-previsoes", usuarioId, rangeDe, rangeAte],
    queryFn: () => listPrevisoesOcorrencia(rangeDe, rangeAte),
    enabled: !!usuarioId,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  // Prefetch das janelas vizinhas para a próxima seta sentir instantânea.
  useEffect(() => {
    if (!usuarioId) return;

    const neighbors = [
      emBreveRangeKey(subDays(windowStart, AGENDA_EM_BREVE_PAGE_SIZE)),
      emBreveRangeKey(addDays(windowStart, AGENDA_EM_BREVE_PAGE_SIZE)),
    ];

    for (const { de, ate } of neighbors) {
      void queryClient.prefetchQuery({
        queryKey: ["recorrencia-previsoes", usuarioId, de, ate],
        queryFn: () => listPrevisoesOcorrencia(de, ate),
        staleTime: 60_000,
      });
    }
  }, [usuarioId, windowStart, queryClient]);

  // Skeleton só no carregamento inicial — ao navegar com setas, mantém o conteúdo
  // anterior (keepPreviousData) para a troca não “piscar”.
  const isInitialLoading =
    !usuarioId ||
    ((loadingTarefas || loadingSubtarefas || loadingPrevisoes) &&
      !tarefas &&
      !subtarefas &&
      !previsoesBundle);
  const isRefreshing = fetchingPrevisoes && !isInitialLoading;

  const byDay = useMemo(() => {
    const map = new Map<string, EmBreveItem[]>();
    for (const day of days) {
      map.set(toLocalDateKey(day)!, []);
    }
    for (const t of tarefas ?? []) {
      if (isSerieModelo(t)) continue;
      const key = toLocalDateKey(t.data_inicio);
      if (!key || !map.has(key)) continue;
      map.get(key)!.push({ kind: "tarefa", tarefa: t });
    }
    for (const s of subtarefas ?? []) {
      const key = toLocalDateKey(s.data_inicio);
      if (!key || !map.has(key)) continue;
      map.get(key)!.push({ kind: "subtarefa", subtarefa: s });
    }
    for (const p of previsoesBundle?.tarefas ?? []) {
      const key = toLocalDateKey(p.data_inicio);
      if (!key || !map.has(key)) continue;
      map.get(key)!.push({ kind: "previsao", previsao: p });
    }
    for (const p of previsoesBundle?.subtarefas ?? []) {
      const key = toLocalDateKey(p.data_inicio);
      if (!key || !map.has(key)) continue;
      map.get(key)!.push({ kind: "previsao_subtarefa", previsao: p });
    }
    for (const [key, items] of map) {
      map.set(
        key,
        [...items].sort((a, b) => {
          const aPrev = a.kind === "previsao" || a.kind === "previsao_subtarefa";
          const bPrev = b.kind === "previsao" || b.kind === "previsao_subtarefa";
          if (aPrev || bPrev) {
            if (aPrev && bPrev) {
              const ta = a.kind === "previsao" || a.kind === "previsao_subtarefa" ? a.previsao.titulo : "";
              const tb = b.kind === "previsao" || b.kind === "previsao_subtarefa" ? b.previsao.titulo : "";
              return ta.localeCompare(tb, "pt-BR");
            }
            return aPrev ? 1 : -1;
          }
          if (a.kind === "tarefa" && b.kind === "tarefa") {
            return compareByClassificar(a.tarefa, b.tarefa, classificar);
          }
          if (a.kind === "subtarefa" && b.kind === "subtarefa") {
            return compareByClassificar(a.subtarefa, b.subtarefa, classificar);
          }
          if (a.kind === "tarefa" && b.kind === "subtarefa") {
            return compareByClassificar(a.tarefa, b.subtarefa, classificar);
          }
          if (a.kind === "subtarefa" && b.kind === "tarefa") {
            return compareByClassificar(a.subtarefa, b.tarefa, classificar);
          }
          return 0;
        }),
      );
    }
    return map;
  }, [tarefas, subtarefas, previsoesBundle, days, classificar]);

  const selectedMonth = windowStart.getMonth();
  const selectedYear = windowStart.getFullYear();
  const yearOptions = useMemo(() => {
    const years = buildYearOptions();
    if (!years.includes(selectedYear)) {
      return [...years, selectedYear].sort((a, b) => a - b);
    }
    return years;
  }, [selectedYear]);

  const shiftWindow = (deltaDays: number) => {
    startTransition(() => {
      setWindowStart((d) => addDays(d, deltaDays));
    });
  };

  const applyPeriod = (month: number, year: number) => {
    startTransition(() => {
      setWindowStart(resolveWindowStartForMonth(new Date(year, month, 1)));
    });
  };

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={String(selectedMonth)}
            onValueChange={(value) => applyPeriod(Number(value), selectedYear)}
          >
            <SelectTrigger className="h-8 w-[140px] capitalize" aria-label="Selecionar mês">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              {MONTH_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="capitalize">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={String(selectedYear)}
            onValueChange={(value) => applyPeriod(selectedMonth, Number(value))}
          >
            <SelectTrigger className="h-8 w-[100px]" aria-label="Selecionar ano">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <TooltipProvider delayDuration={400}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Select
                    value={classificar}
                    onValueChange={(value) =>
                      handleClassificarChange(value as TarefaClassificar)
                    }
                  >
                    <SelectTrigger className="h-8 w-[168px]" aria-label="Classificar">
                      <SelectValue placeholder="Classificar" />
                    </SelectTrigger>
                    <SelectContent>
                      {CLASSIFICAR_OPTIONS_HOJE_EM_BREVE.map((option) => (
                        <SelectItem
                          key={option}
                          value={option}
                          title={TAREFA_CLASSIFICAR_HINTS[option]}
                        >
                          {TAREFA_CLASSIFICAR_LABELS[option]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TooltipTrigger>
              {TAREFA_CLASSIFICAR_HINTS[classificar] && (
                <TooltipContent side="bottom" className="max-w-xs text-xs">
                  {TAREFA_CLASSIFICAR_HINTS[classificar]}
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            aria-label="Dias anteriores"
            onClick={() => shiftWindow(-AGENDA_EM_BREVE_PAGE_SIZE)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            aria-label="Próximos dias"
            onClick={() => shiftWindow(AGENDA_EM_BREVE_PAGE_SIZE)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "grid h-[min(720px,calc(100dvh-13rem))] min-h-[280px] grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4",
          isRefreshing && "opacity-70 transition-opacity",
        )}
      >
        {days.map((day) => {
          const key = toLocalDateKey(day)!;
          const items = byDay.get(key) ?? [];
          const isToday = key === todayKey;

          return (
            <section
              key={key}
              className={cn(
                "flex min-h-0 flex-col overflow-hidden rounded-xl border bg-muted/20",
                isToday && "border-primary/40 bg-primary/5",
              )}
            >
              <header className="flex shrink-0 items-baseline justify-between gap-2 border-b bg-inherit px-3 py-2.5">
                <div>
                  <p className="text-sm font-semibold tabular-nums">
                    {format(day, "d")}{" "}
                    <span className="font-medium capitalize text-muted-foreground">
                      {format(day, "EEEE", { locale: ptBR })}
                    </span>
                  </p>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {items.length}
                </span>
              </header>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-2.5">
                {isInitialLoading ? (
                  <>
                    <Skeleton className="h-14 rounded-lg" />
                    <Skeleton className="h-14 rounded-lg" />
                  </>
                ) : (
                  items.map((item) =>
                    item.kind === "tarefa" ? (
                      <EmBreveTaskCard
                        key={`tarefa-${item.tarefa.id}`}
                        tarefa={item.tarefa}
                        onOpen={() => onOpenTarefa(item.tarefa)}
                      />
                    ) : item.kind === "subtarefa" ? (
                      <SubtarefaAgendaCard
                        key={`subtarefa-${item.subtarefa.id}`}
                        subtarefa={item.subtarefa}
                        onOpen={() => onOpenSubtarefa(item.subtarefa)}
                        compact
                      />
                    ) : item.kind === "previsao" ? (
                      <EmBrevePrevisaoCard
                        key={`previsao-${item.previsao.serie_raiz_id}-${item.previsao.data_inicio}`}
                        previsao={item.previsao}
                      />
                    ) : (
                      <EmBrevePrevisaoSubtarefaCard
                        key={`previsao-sub-${item.previsao.serie_raiz_id}-${item.previsao.modelo_subtarefa_id}-${item.previsao.data_inicio}`}
                        previsao={item.previsao}
                      />
                    ),
                  )
                )}
              </div>

              <div className="shrink-0 border-t bg-inherit p-2">
                <button
                  type="button"
                  onClick={() => onCreateForDate(day)}
                  className="flex w-full items-center gap-1.5 rounded-lg px-2 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar tarefa
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
