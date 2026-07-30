import { Plus } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AgendaViewSelector } from "@/components/tarefas/agenda-view-selector";
import { MoverTarefaDialog } from "@/components/tarefas/mover-tarefa-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TarefaCardsGrid } from "@/components/tarefas/tarefa-cards-grid";
import { TarefaColunasBoard } from "@/components/tarefas/tarefa-colunas-board";
import { TarefaFiltersBar } from "@/components/tarefas/tarefa-filters";
import { TarefaListView } from "@/components/tarefas/tarefa-list-view";
import { useDuplicateTarefa, useTarefas } from "@/hooks/use-tarefas";
import { DENSE_CARD_GRID_CLASS } from "@/lib/layout";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import type {
  ProfileWithSetor,
  Projeto,
  SetorWithGerente,
  TarefaFilters,
  TarefaWithRelations,
} from "@/types";
import {
  normalizeTarefaClassificar,
  readAgendaClassificarPreference,
  writeAgendaClassificarPreference,
  type AgendaClassificarScope,
  type TarefaClassificar,
} from "@/utils/agenda-classificar-preference";
import {
  normalizeAgendaViewMode,
  readAgendaViewPreference,
  writeAgendaViewPreference,
  type AgendaViewMode,
  type AgendaViewPreferenceScope,
} from "@/utils/agenda-view-preference";
import { sortByClassificar } from "@/utils/tarefas";

export type { AgendaViewMode, AgendaViewPreferenceScope };

function toClassificarScope(
  scope: AgendaViewPreferenceScope,
): AgendaClassificarScope | null {
  if (scope === "finalizados") return null;
  if (
    scope === "agenda-geral" ||
    scope === "agenda-visualizando" ||
    scope === "equipe" ||
    scope === "projeto-detalhe" ||
    scope === "recorrentes-pasta"
  ) {
    return scope;
  }
  return null;
}

export type AgendaBoardState = {
  filters: TarefaFilters;
  debouncedFilters: TarefaFilters;
  view: AgendaViewMode;
};

export function createAgendaBoardState(
  overrides?: Partial<TarefaFilters>,
  preference?: {
    userId?: string | null;
    scope: AgendaViewPreferenceScope;
  },
): AgendaBoardState {
  const classificarScope = preference ? toClassificarScope(preference.scope) : null;
  const classificar = classificarScope
    ? readAgendaClassificarPreference(preference?.userId, classificarScope)
    : undefined;

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
      ...(classificar ? { classificar } : {}),
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
      ...(classificar ? { classificar } : {}),
      ...overrides,
    },
    view: preference
      ? readAgendaViewPreference(preference.userId, preference.scope)
      : "cards",
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
  forceRecorrenciaPastaId,
  somenteModelos = false,
  emptyMessage,
  createLabel,
  canEdit,
  canDeleteTarefa,
  canToggleConcluida,
  onOpenTarefa,
  onCreate,
  onToggleConcluida,
  onDelete,
  onMoveSerie,
  somenteFinalizadas = false,
  hideCreate = false,
  hideColunas = false,
  preferenceScope,
  preferenceUserId,
}: {
  state: AgendaBoardState;
  onStateChange: (state: AgendaBoardState) => void;
  setores: SetorWithGerente[];
  projetos: Pick<Projeto, "id" | "nome">[];
  pessoas: ProfileWithSetor[];
  hideProjeto?: boolean;
  hideResponsavel?: boolean;
  forceProjetoId?: string;
  /** Pasta de recorrência (`entradas` = séries sem pasta). */
  forceRecorrenciaPastaId?: string;
  /** Lista apenas modelos de série. */
  somenteModelos?: boolean;
  emptyMessage: string;
  createLabel?: string;
  canEdit: (tarefa: TarefaWithRelations) => boolean;
  canDeleteTarefa: (tarefa: TarefaWithRelations) => boolean;
  /** Permissão específica da bolinha: concluir (aberta) ou reabrir (concluída, respeita janela de reabertura). */
  canToggleConcluida: (tarefa: TarefaWithRelations) => boolean;
  onOpenTarefa: (tarefa: TarefaWithRelations) => void;
  onCreate: () => void;
  onToggleConcluida: (tarefa: TarefaWithRelations, concluida: boolean) => void;
  onDelete: (tarefa: TarefaWithRelations) => void;
  /** Quando definido, o "Mover" abre este fluxo em vez do diálogo de projeto/setor. */
  onMoveSerie?: (tarefa: TarefaWithRelations) => void;
  somenteFinalizadas?: boolean;
  hideCreate?: boolean;
  /** Quando true, oculta opção Colunas (Equipe, Finalizados, Projeto, etc.). */
  hideColunas?: boolean;
  preferenceScope: AgendaViewPreferenceScope;
  preferenceUserId?: string | null;
}) {
  const colunasDesabilitadas = hideColunas || somenteFinalizadas;
  const view = normalizeView(state.view);
  const effectiveView =
    colunasDesabilitadas && view === "colunas" ? ("cards" as const) : view;
  const { filters, debouncedFilters } = state;
  const stateRef = useRef(state);
  stateRef.current = state;

  const duplicateTarefa = useDuplicateTarefa();
  const [movingTarefa, setMovingTarefa] = useState<TarefaWithRelations | null>(null);

  const handleDuplicate = async (tarefa: TarefaWithRelations) => {
    try {
      await duplicateTarefa.mutateAsync(tarefa.id);
      toast.success("Tarefa duplicada");
    } catch (error) {
      toast.error("Erro ao duplicar tarefa", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  const handleFiltersChange = useMemo(() => {
    let timeout: ReturnType<typeof setTimeout>;
    return (next: TarefaFilters) => {
      const classificarScope = toClassificarScope(preferenceScope);
      if (
        classificarScope &&
        next.classificar &&
        next.classificar !== stateRef.current.filters.classificar
      ) {
        writeAgendaClassificarPreference(
          preferenceUserId,
          classificarScope,
          normalizeTarefaClassificar(next.classificar),
        );
      }

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
  }, [onStateChange, preferenceScope, preferenceUserId]);

  const handleViewChange = (nextView: AgendaViewMode) => {
    const normalized = normalizeView(nextView);
    writeAgendaViewPreference(preferenceUserId, preferenceScope, normalized);
    onStateChange({
      ...stateRef.current,
      view: normalized,
    });
  };

  const queryFilters = useMemo(() => {
    const base = somenteFinalizadas
      ? { ...debouncedFilters, somente_finalizadas: true as const }
      : somenteModelos
        ? { ...debouncedFilters, somente_modelos: true as const }
        : { ...debouncedFilters, excluir_finalizadas: true as const };

    if (forceProjetoId) {
      return { ...base, projeto_id: forceProjetoId };
    }

    if (forceRecorrenciaPastaId) {
      return { ...base, recorrencia_pasta_id: forceRecorrenciaPastaId };
    }

    return base;
  }, [
    debouncedFilters,
    forceProjetoId,
    forceRecorrenciaPastaId,
    somenteFinalizadas,
    somenteModelos,
  ]);

  const { data: tarefas, isLoading } = useTarefas(queryFilters);

  const classificarMode: TarefaClassificar = normalizeTarefaClassificar(
    filters.classificar,
  );
  const sortedTarefas = useMemo(
    () => (tarefas ? sortByClassificar(tarefas, classificarMode) : []),
    [tarefas, classificarMode],
  );

  /** Classificar define a ordem — desativa reordenação manual em Cards/Lista. */
  const enableReorder = false;
  const classificarOptions: TarefaClassificar[] = somenteFinalizadas
    ? []
    : ["prioridade", "data_asc"];

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
            classificarOptions={classificarOptions}
          />
        </div>
        <AgendaViewSelector
          value={effectiveView}
          onChange={handleViewChange}
          hideColunas={colunasDesabilitadas}
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
          ) : !sortedTarefas.length ? (
            <EmptyState
              message={emptyMessage}
              onCreate={onCreate}
              hideCreate={hideCreate}
              createLabel={createLabel}
            />
          ) : (
            <TarefaCardsGrid
              tarefas={sortedTarefas}
              canEdit={canEdit}
              canDeleteTarefa={canDeleteTarefa}
              canToggleConcluida={canToggleConcluida}
              onOpenTarefa={onOpenTarefa}
              onDuplicate={(tarefa) => void handleDuplicate(tarefa)}
              onMove={onMoveSerie ?? setMovingTarefa}
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
          ) : !sortedTarefas.length ? (
            <EmptyState
              message={emptyMessage}
              onCreate={onCreate}
              hideCreate={hideCreate}
              createLabel={createLabel}
            />
          ) : (
            <TarefaListView
              tarefas={sortedTarefas}
              onOpenTarefa={onOpenTarefa}
              onToggleConcluida={onToggleConcluida}
              canToggleConcluida={canToggleConcluida}
              canEdit={canEdit}
              canDeleteTarefa={canDeleteTarefa}
              onDuplicate={(tarefa) => void handleDuplicate(tarefa)}
              onMove={onMoveSerie ?? setMovingTarefa}
              onDelete={onDelete}
              enableReorder={enableReorder}
            />
          )}
        </div>
      )}

      {effectiveView === "colunas" && !colunasDesabilitadas && (
        <div>
          {isLoading ? (
            <div className="flex gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-[520px] min-w-[280px] flex-1 rounded-xl" />
              ))}
            </div>
          ) : !sortedTarefas.length ? (
            <EmptyState
              message={emptyMessage}
              onCreate={onCreate}
              hideCreate={hideCreate}
              createLabel={createLabel}
            />
          ) : (
            <TarefaColunasBoard
              tarefas={sortedTarefas}
              onOpenTarefa={onOpenTarefa}
              onToggleConcluida={onToggleConcluida}
              canToggleConcluida={canToggleConcluida}
              canEdit={canEdit}
              canDeleteTarefa={canDeleteTarefa}
              onDuplicate={(tarefa) => void handleDuplicate(tarefa)}
              onMove={setMovingTarefa}
              onDelete={onDelete}
            />
          )}
        </div>
      )}

      <MoverTarefaDialog
        tarefa={onMoveSerie ? null : movingTarefa}
        open={!onMoveSerie && !!movingTarefa}
        onOpenChange={(open) => {
          if (!open) setMovingTarefa(null);
        }}
        setores={setores}
        projetos={projetos}
      />
    </div>
  );
}

function EmptyState({
  message,
  onCreate,
  hideCreate = false,
  createLabel = "Criar primeira tarefa",
}: {
  message: string;
  onCreate: () => void;
  hideCreate?: boolean;
  createLabel?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed p-12 text-center">
      <p className="text-muted-foreground">{message}</p>
      {!hideCreate && (
        <Button variant="outline" className="mt-4 gap-2" onClick={onCreate}>
          <Plus className="h-4 w-4" />
          {createLabel}
        </Button>
      )}
    </div>
  );
}
