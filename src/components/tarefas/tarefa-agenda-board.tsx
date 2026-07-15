import { Plus } from "lucide-react";
import { useMemo, useRef } from "react";
import { AgendaViewSelector } from "@/components/tarefas/agenda-view-selector";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TarefaCardsGrid } from "@/components/tarefas/tarefa-cards-grid";
import { TarefaColunasBoard } from "@/components/tarefas/tarefa-colunas-board";
import { TarefaFiltersBar } from "@/components/tarefas/tarefa-filters";
import { TarefaListView } from "@/components/tarefas/tarefa-list-view";
import { useTarefas } from "@/hooks/use-tarefas";
import { DENSE_CARD_GRID_CLASS } from "@/lib/layout";
import type {
  ProfileWithSetor,
  Projeto,
  SetorWithGerente,
  TarefaFilters,
  TarefaWithRelations,
} from "@/types";
import {
  normalizeAgendaViewMode,
  readAgendaViewPreference,
  writeAgendaViewPreference,
  type AgendaViewMode,
} from "@/utils/agenda-view-preference";

export type { AgendaViewMode };

export type AgendaBoardState = {
  filters: TarefaFilters;
  debouncedFilters: TarefaFilters;
  view: AgendaViewMode;
};

export function createAgendaBoardState(
  overrides?: Partial<TarefaFilters>,
): AgendaBoardState {
  return {
    filters: {
      prioridade: "all",
      setor_id: "all",
      projeto_id: "all",
      atribuido_a: "all",
      atribuido_ids: [],
      search: "",
      tag: "",
      periodo_inicio: "",
      periodo_fim: "",
      ...overrides,
    },
    debouncedFilters: {
      prioridade: "all",
      setor_id: "all",
      projeto_id: "all",
      atribuido_a: "all",
      atribuido_ids: [],
      search: "",
      tag: "",
      periodo_inicio: "",
      periodo_fim: "",
      ...overrides,
    },
    view: readAgendaViewPreference(),
  };
}

function normalizeView(view: string): AgendaViewMode {
  return normalizeAgendaViewMode(view);
}

export function TarefaAgendaBoard({
  state,
  onStateChange,
  setores,
  projetos,
  pessoas,
  hideProjeto = false,
  hideResponsavel = false,
  forceProjetoId,
  emptyMessage,
  canEdit,
  canDeleteTarefa,
  onOpenTarefa,
  onCreate,
  onToggleConcluida,
  onDelete,
  somenteFinalizadas = false,
  hideCreate = false,
}: {
  state: AgendaBoardState;
  onStateChange: (state: AgendaBoardState) => void;
  setores: SetorWithGerente[];
  projetos: Pick<Projeto, "id" | "nome">[];
  pessoas: ProfileWithSetor[];
  hideProjeto?: boolean;
  hideResponsavel?: boolean;
  forceProjetoId?: string;
  emptyMessage: string;
  canEdit: (tarefa: TarefaWithRelations) => boolean;
  canDeleteTarefa: (tarefa: TarefaWithRelations) => boolean;
  onOpenTarefa: (tarefa: TarefaWithRelations) => void;
  onCreate: () => void;
  onToggleConcluida: (tarefa: TarefaWithRelations, concluida: boolean) => void;
  onDelete: (tarefa: TarefaWithRelations) => void;
  somenteFinalizadas?: boolean;
  hideCreate?: boolean;
}) {
  const view = normalizeView(state.view);
  const effectiveView =
    somenteFinalizadas && view === "colunas" ? ("cards" as const) : view;
  const { filters, debouncedFilters } = state;
  const stateRef = useRef(state);
  stateRef.current = state;

  const handleFiltersChange = useMemo(() => {
    let timeout: ReturnType<typeof setTimeout>;
    return (next: TarefaFilters) => {
      onStateChange({
        ...stateRef.current,
        filters: next,
      });
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        onStateChange({
          ...stateRef.current,
          filters: next,
          debouncedFilters: next,
        });
      }, 300);
    };
  }, [onStateChange]);

  const handleViewChange = (nextView: AgendaViewMode) => {
    const normalized = normalizeView(nextView);
    writeAgendaViewPreference(normalized);
    onStateChange({
      ...stateRef.current,
      view: normalized,
    });
  };

  const queryFilters = useMemo(() => {
    const base = somenteFinalizadas
      ? { ...debouncedFilters, somente_finalizadas: true as const }
      : { ...debouncedFilters, excluir_finalizadas: true as const };

    if (forceProjetoId) {
      return { ...base, projeto_id: forceProjetoId };
    }

    return base;
  }, [debouncedFilters, forceProjetoId, somenteFinalizadas]);

  const { data: tarefas, isLoading } = useTarefas(queryFilters);
  const enableReorder = !somenteFinalizadas;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <TarefaFiltersBar
            filters={filters}
            onChange={handleFiltersChange}
            setores={setores}
            projetos={projetos}
            pessoas={pessoas}
            hideProjeto={hideProjeto}
            hideResponsavel={hideResponsavel}
            variant={somenteFinalizadas ? "finalizados" : "default"}
          />
        </div>
        <AgendaViewSelector
          value={effectiveView}
          onChange={handleViewChange}
          hideColunas={somenteFinalizadas}
        />
      </div>

      {effectiveView === "cards" && (
        <div>
          {isLoading ? (
            <div className={DENSE_CARD_GRID_CLASS}>
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-36 rounded-xl" />
              ))}
            </div>
          ) : !tarefas?.length ? (
            <EmptyState message={emptyMessage} onCreate={onCreate} hideCreate={hideCreate} />
          ) : (
            <TarefaCardsGrid
              tarefas={tarefas}
              canEdit={canEdit}
              canDeleteTarefa={canDeleteTarefa}
              onOpenTarefa={onOpenTarefa}
              onDelete={onDelete}
              onToggleConcluida={onToggleConcluida}
              enableReorder={enableReorder}
            />
          )}
        </div>
      )}

      {effectiveView === "lista" && (
        <div>
          {isLoading ? (
            <div className="space-y-2 rounded-xl border p-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : !tarefas?.length ? (
            <EmptyState message={emptyMessage} onCreate={onCreate} hideCreate={hideCreate} />
          ) : (
            <TarefaListView
              tarefas={tarefas}
              onOpenTarefa={onOpenTarefa}
              onToggleConcluida={onToggleConcluida}
              enableReorder={enableReorder}
            />
          )}
        </div>
      )}

      {effectiveView === "colunas" && !somenteFinalizadas && (
        <div>
          {isLoading ? (
            <div className="flex gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-[520px] min-w-[280px] flex-1 rounded-xl" />
              ))}
            </div>
          ) : !tarefas?.length ? (
            <EmptyState message={emptyMessage} onCreate={onCreate} hideCreate={hideCreate} />
          ) : (
            <TarefaColunasBoard
              tarefas={tarefas}
              onOpenTarefa={onOpenTarefa}
              onToggleConcluida={onToggleConcluida}
            />
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({
  message,
  onCreate,
  hideCreate = false,
}: {
  message: string;
  onCreate: () => void;
  hideCreate?: boolean;
}) {
  return (
    <div className="rounded-xl border border-dashed p-12 text-center">
      <p className="text-muted-foreground">{message}</p>
      {!hideCreate && (
        <Button variant="outline" className="mt-4 gap-2" onClick={onCreate}>
          <Plus className="h-4 w-4" />
          Criar primeira tarefa
        </Button>
      )}
    </div>
  );
}
