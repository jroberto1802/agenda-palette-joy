import { Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AgendaAtrasadasSection } from "@/components/tarefas/agenda-atrasadas-section";
import { SubtarefaAgendaListRow } from "@/components/tarefas/subtarefa-agenda-item";
import { TarefaFiltersBar } from "@/components/tarefas/tarefa-filters";
import { TarefaListRowContent } from "@/components/tarefas/tarefa-list-view";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  useSubtarefasAgenda,
  useTarefas,
  useToggleSubtarefa,
  useUpdateTarefaConclusao,
} from "@/hooks/use-tarefas";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import { AGENDA_ATRASADAS_LIMIT } from "@/services/tarefas";
import type {
  Projeto,
  SetorWithGerente,
  SubtarefaAgendaItem,
  TarefaFilters,
  TarefaWithRelations,
} from "@/types";
import {
  CLASSIFICAR_OPTIONS_HOJE_EM_BREVE,
  normalizeTarefaClassificar,
  readAgendaClassificarPreference,
  writeAgendaClassificarPreference,
  type TarefaClassificar,
} from "@/utils/agenda-classificar-preference";
import { startOfTodayLocal, toLocalDateKey } from "@/utils/agenda-datas";
import { isSerieModelo } from "@/utils/recorrencia";
import { compareByClassificar } from "@/utils/tarefas";

type AgendaHojeItem =
  | { kind: "tarefa"; tarefa: TarefaWithRelations }
  | { kind: "subtarefa"; subtarefa: SubtarefaAgendaItem };

function createEmptyHojeFilters(
  classificar: TarefaClassificar = "prioridade_hora",
): TarefaFilters {
  return {
    prioridade: "all",
    setor_id: "all",
    projeto_id: "all",
    atribuido_a: "all",
    atribuido_ids: [],
    search: "",
    tag: "",
    classificar,
  };
}

function isAtrasada(dataInicio: string | null | undefined, hojeKey: string): boolean {
  const key = toLocalDateKey(dataInicio);
  return !!key && key < hojeKey;
}

function sortAgendaItems(
  items: AgendaHojeItem[],
  mode: TarefaClassificar,
): AgendaHojeItem[] {
  return [...items].sort((a, b) => {
    const left = a.kind === "tarefa" ? a.tarefa : a.subtarefa;
    const right = b.kind === "tarefa" ? b.tarefa : b.subtarefa;
    return compareByClassificar(left, right, mode);
  });
}

export function AgendaHojeView({
  usuarioId,
  setores,
  projetos,
  onOpenTarefa,
  onOpenSubtarefa,
  onCreate,
}: {
  usuarioId: string | undefined;
  setores: SetorWithGerente[];
  projetos: Pick<Projeto, "id" | "nome">[];
  onOpenTarefa: (tarefa: TarefaWithRelations) => void;
  onOpenSubtarefa: (subtarefa: SubtarefaAgendaItem) => void;
  onCreate: () => void;
}) {
  const hojeKey = toLocalDateKey(startOfTodayLocal())!;
  const updateConclusao = useUpdateTarefaConclusao();
  const toggleSubtarefaMut = useToggleSubtarefa();

  const [filters, setFilters] = useState<TarefaFilters>(() => createEmptyHojeFilters());
  const [debouncedFilters, setDebouncedFilters] = useState<TarefaFilters>(() =>
    createEmptyHojeFilters(),
  );
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!usuarioId) return;
    const classificar = readAgendaClassificarPreference(usuarioId, "agenda-hoje");
    setFilters((prev) =>
      prev.classificar === classificar ? prev : { ...prev, classificar },
    );
    setDebouncedFilters((prev) =>
      prev.classificar === classificar ? prev : { ...prev, classificar },
    );
  }, [usuarioId]);

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    };
  }, []);

  const handleFiltersChange = (next: TarefaFilters) => {
    if (next.classificar && next.classificar !== filtersRef.current.classificar) {
      writeAgendaClassificarPreference(
        usuarioId,
        "agenda-hoje",
        normalizeTarefaClassificar(next.classificar, "agenda-hoje"),
      );
    }
    setFilters(next);
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = setTimeout(() => setDebouncedFilters(next), 300);
  };
  const handleToggleConcluida = async (tarefa: TarefaWithRelations, concluida: boolean) => {
    try {
      await updateConclusao.mutateAsync({ id: tarefa.id, concluida });
      toast.success(concluida ? "Tarefa concluída" : "Tarefa reaberta");
    } catch (error) {
      toast.error(concluida ? "Erro ao concluir tarefa" : "Erro ao reabrir tarefa", {
        description: getSupabaseErrorMessage(error as Error),
      });
      throw error;
    }
  };

  const handleToggleSubtarefa = async (subtarefa: SubtarefaAgendaItem, concluida: boolean) => {
    try {
      await toggleSubtarefaMut.mutateAsync({ id: subtarefa.id, concluida });
      toast.success(concluida ? "Subtarefa concluída" : "Subtarefa reaberta");
    } catch (error) {
      toast.error(concluida ? "Erro ao concluir subtarefa" : "Erro ao reabrir subtarefa", {
        description: getSupabaseErrorMessage(error as Error),
      });
      throw error;
    }
  };

  const sharedFilter = {
    ...debouncedFilters,
    excluir_finalizadas: true as const,
    atribuido_ids: usuarioId ? [usuarioId] : [],
    tag: "",
    lite: true as const,
  };

  const { data: tarefas, isLoading: loadingTarefas, isFetched: fetchedTarefas } = useTarefas(
    {
      ...sharedFilter,
      data_inicio_de: hojeKey,
      data_inicio_ate: hojeKey,
    },
    { enabled: !!usuarioId },
  );

  const {
    data: subtarefas,
    isLoading: loadingSubtarefas,
    isFetched: fetchedSubtarefas,
  } = useSubtarefasAgenda(
    {
      usuario_id: usuarioId ?? "",
      data_inicio_de: hojeKey,
      data_inicio_ate: hojeKey,
      search: debouncedFilters.search,
      prioridade: debouncedFilters.prioridade,
      setor_id: debouncedFilters.setor_id,
      projeto_id: debouncedFilters.projeto_id,
      lite: true,
    },
    { enabled: !!usuarioId },
  );

  // Atrasadas só depois do dia: no Free tier, 4 queries pesadas em paralelo
  // competem pela mesma CPU compartilhada e atrasam o "Hoje".
  const atrasadasEnabled = !!usuarioId && fetchedTarefas && fetchedSubtarefas;

  const { data: tarefasAtrasadas, isLoading: loadingTarefasAtrasadas } = useTarefas(
    {
      ...sharedFilter,
      somente_atrasadas: true,
      excluir_finalizadas: true,
      limit: AGENDA_ATRASADAS_LIMIT,
    },
    { enabled: atrasadasEnabled },
  );

  const { data: subtarefasAtrasadas, isLoading: loadingSubtarefasAtrasadas } =
    useSubtarefasAgenda(
      {
        usuario_id: usuarioId ?? "",
        somente_atrasadas: true,
        search: debouncedFilters.search,
        prioridade: debouncedFilters.prioridade,
        setor_id: debouncedFilters.setor_id,
        projeto_id: debouncedFilters.projeto_id,
        lite: true,
        limit: AGENDA_ATRASADAS_LIMIT,
      },
      { enabled: atrasadasEnabled },
    );

  const classificarMode: TarefaClassificar = normalizeTarefaClassificar(
    debouncedFilters.classificar,
    "agenda-hoje",
  );

  const itemsHoje = useMemo((): AgendaHojeItem[] => {
    const tarefasDoDia = (tarefas ?? []).filter(
      (t) => !isSerieModelo(t) && toLocalDateKey(t.data_inicio) === hojeKey,
    );
    const subtarefasDoDia = (subtarefas ?? []).filter(
      (s) => toLocalDateKey(s.data_inicio) === hojeKey,
    );

    return sortAgendaItems(
      [
        ...tarefasDoDia.map((tarefa) => ({ kind: "tarefa" as const, tarefa })),
        ...subtarefasDoDia.map((subtarefa) => ({ kind: "subtarefa" as const, subtarefa })),
      ],
      classificarMode,
    );
  }, [tarefas, subtarefas, hojeKey, classificarMode]);

  const itemsAtrasadas = useMemo((): AgendaHojeItem[] => {
    const tarefasVencidas = (tarefasAtrasadas ?? []).filter(
      (t) => !isSerieModelo(t) && isAtrasada(t.data_inicio, hojeKey),
    );
    const subtarefasVencidas = (subtarefasAtrasadas ?? []).filter((s) =>
      isAtrasada(s.data_inicio, hojeKey),
    );

    return sortAgendaItems(
      [
        ...tarefasVencidas.map((tarefa) => ({ kind: "tarefa" as const, tarefa })),
        ...subtarefasVencidas.map((subtarefa) => ({ kind: "subtarefa" as const, subtarefa })),
      ],
      classificarMode,
    );
  }, [tarefasAtrasadas, subtarefasAtrasadas, hojeKey, classificarMode]);

  // Progressive: lista do dia não espera atrasadas.
  const isLoadingHoje = !usuarioId || loadingTarefas || loadingSubtarefas;
  const isLoadingAtrasadas =
    !atrasadasEnabled || loadingTarefasAtrasadas || loadingSubtarefasAtrasadas;
  const hasActiveFilters =
    !!(debouncedFilters.search?.trim()) ||
    (debouncedFilters.prioridade && debouncedFilters.prioridade !== "all") ||
    (debouncedFilters.setor_id && debouncedFilters.setor_id !== "all") ||
    (debouncedFilters.projeto_id && debouncedFilters.projeto_id !== "all");
  const hasAnyItems = itemsAtrasadas.length > 0 || itemsHoje.length > 0;
  const atrasadasTruncadas =
    (tarefasAtrasadas?.length ?? 0) >= AGENDA_ATRASADAS_LIMIT ||
    (subtarefasAtrasadas?.length ?? 0) >= AGENDA_ATRASADAS_LIMIT;

  return (
    <div className="space-y-4">
      <TarefaFiltersBar
        filters={filters}
        onChange={handleFiltersChange}
        setores={setores}
        projetos={projetos}
        pessoas={[]}
        hideResponsavel
        variant="hoje"
        classificarOptions={CLASSIFICAR_OPTIONS_HOJE_EM_BREVE}
      />

      {isLoadingHoje ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : !hasAnyItems && !isLoadingAtrasadas ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <p className="text-muted-foreground">
            {hasActiveFilters
              ? "Nenhum resultado para os filtros atuais."
              : "Nenhuma tarefa ou subtarefa com Data para hoje."}
          </p>
          {!hasActiveFilters && (
            <Button variant="outline" className="mt-4 gap-2" onClick={onCreate}>
              <Plus className="h-4 w-4" />
              Adicionar tarefa
            </Button>
          )}
        </div>
      ) : (
        <TooltipProvider delayDuration={200}>
          <div className="max-h-[min(70vh,720px)] space-y-5 overflow-y-auto pr-1">
            {isLoadingAtrasadas ? (
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-14 rounded-xl" />
                <Skeleton className="h-14 rounded-xl" />
              </div>
            ) : (
              <AgendaAtrasadasSection
                items={itemsAtrasadas}
                truncated={atrasadasTruncadas}
                limit={AGENDA_ATRASADAS_LIMIT}
                onOpenTarefa={onOpenTarefa}
                onOpenSubtarefa={onOpenSubtarefa}
              />
            )}

            {itemsHoje.length > 0 ? (
              <section className="space-y-2">
                {(itemsAtrasadas.length > 0 || isLoadingAtrasadas) && (
                  <h3 className="text-sm font-semibold text-foreground">Hoje</h3>
                )}
                <ul className="space-y-2">
                  {itemsHoje.map((item) =>
                    item.kind === "tarefa" ? (
                      <li key={`tarefa-${item.tarefa.id}`}>
                        <TarefaListRowContent
                          tarefa={item.tarefa}
                          onOpen={() => onOpenTarefa(item.tarefa)}
                          onToggleConcluida={(concluida) =>
                            handleToggleConcluida(item.tarefa, concluida)
                          }
                        />
                      </li>
                    ) : (
                      <li key={`subtarefa-${item.subtarefa.id}`}>
                        <SubtarefaAgendaListRow
                          subtarefa={item.subtarefa}
                          onOpen={() => onOpenSubtarefa(item.subtarefa)}
                          onToggleConcluida={(concluida) =>
                            handleToggleSubtarefa(item.subtarefa, concluida)
                          }
                        />
                      </li>
                    ),
                  )}
                </ul>
              </section>
            ) : itemsAtrasadas.length > 0 || isLoadingAtrasadas ? (
              <p className="text-sm text-muted-foreground">
                {hasActiveFilters
                  ? "Nenhum item de hoje para os filtros atuais."
                  : "Nenhuma tarefa ou subtarefa com Data para hoje."}
              </p>
            ) : null}
          </div>
        </TooltipProvider>
      )}
    </div>
  );
}
