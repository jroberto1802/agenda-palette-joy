import { Plus } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AgendaViewSelector } from "@/components/tarefas/agenda-view-selector";
import { MoverTarefaDialog } from "@/components/tarefas/mover-tarefa-dialog";
import { SubtarefaAgendaCard, SubtarefaAgendaListRow } from "@/components/tarefas/subtarefa-agenda-item";
import { TarefaCardsGrid } from "@/components/tarefas/tarefa-cards-grid";
import { TarefaFiltersBar } from "@/components/tarefas/tarefa-filters";
import { TarefaListView } from "@/components/tarefas/tarefa-list-view";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDuplicateTarefa,
  useSubtarefasAgenda,
  useTarefas,
  useToggleSubtarefa,
} from "@/hooks/use-tarefas";
import { DENSE_CARD_GRID_CLASS } from "@/lib/layout";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import type {
  ProfileWithSetor,
  Projeto,
  SetorWithGerente,
  SubtarefaAgendaItem,
  TarefaFilters,
  TarefaWithRelations,
} from "@/types";
import {
  normalizeAgendaViewMode,
  readAgendaViewPreference,
  writeAgendaViewPreference,
  type AgendaViewMode,
} from "@/utils/agenda-view-preference";

export type VisualizandoBoardState = {
  filters: TarefaFilters;
  debouncedFilters: TarefaFilters;
  view: AgendaViewMode;
};

export function createVisualizandoBoardState(
  preference?: { userId?: string | null },
): VisualizandoBoardState {
  return {
    filters: {
      prioridade: "all",
      setor_id: "all",
      projeto_id: "all",
      atribuido_a: "all",
      atribuido_ids: [],
      search: "",
      tag: "",
    },
    debouncedFilters: {
      prioridade: "all",
      setor_id: "all",
      projeto_id: "all",
      atribuido_a: "all",
      atribuido_ids: [],
      search: "",
      tag: "",
    },
    view: preference
      ? readAgendaViewPreference(preference.userId, "agenda-visualizando")
      : "cards",
  };
}

export function AgendaVisualizandoView({
  usuarioId,
  state,
  onStateChange,
  setores,
  projetos,
  pessoas,
  canEdit,
  canDeleteTarefa,
  canToggleConcluida,
  onOpenTarefa,
  onOpenSubtarefa,
  onCreate,
  onToggleConcluida,
  onDelete,
}: {
  usuarioId: string | undefined;
  state: VisualizandoBoardState;
  onStateChange: (state: VisualizandoBoardState) => void;
  setores: SetorWithGerente[];
  projetos: Pick<Projeto, "id" | "nome">[];
  pessoas: ProfileWithSetor[];
  canEdit: (tarefa: TarefaWithRelations) => boolean;
  canDeleteTarefa: (tarefa: TarefaWithRelations) => boolean;
  canToggleConcluida: (tarefa: TarefaWithRelations) => boolean;
  onOpenTarefa: (tarefa: TarefaWithRelations) => void;
  onOpenSubtarefa: (subtarefa: SubtarefaAgendaItem) => void;
  onCreate: () => void;
  onToggleConcluida: (tarefa: TarefaWithRelations, concluida: boolean) => void;
  onDelete: (tarefa: TarefaWithRelations) => void;
}) {
  const viewRaw = normalizeAgendaViewMode(state.view);
  /** Visualizando: apenas Cards ou Lista. */
  const view = viewRaw === "colunas" ? "cards" : viewRaw;
  const { filters, debouncedFilters } = state;
  const stateRef = useRef(state);
  stateRef.current = state;

  const duplicateTarefa = useDuplicateTarefa();
  const toggleSubtarefaMut = useToggleSubtarefa();
  const [movingTarefa, setMovingTarefa] = useState<TarefaWithRelations | null>(null);

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
    const normalized = normalizeAgendaViewMode(nextView);
    const allowed = normalized === "colunas" ? "cards" : normalized;
    writeAgendaViewPreference(usuarioId, "agenda-visualizando", allowed);
    onStateChange({
      ...stateRef.current,
      view: allowed,
    });
  };

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

  const { data: tarefas, isLoading: loadingTarefas } = useTarefas(
    {
      ...debouncedFilters,
      excluir_finalizadas: true,
      somente_visualizando: true,
      projeto_id: "all",
      tag: "",
    },
    { enabled: !!usuarioId },
  );

  const { data: subtarefas, isLoading: loadingSubtarefas } = useSubtarefasAgenda(
    {
      usuario_id: usuarioId ?? "",
      somente_visualizando: true,
      search: debouncedFilters.search,
      prioridade: debouncedFilters.prioridade,
      setor_id: debouncedFilters.setor_id,
      atribuido_ids: debouncedFilters.atribuido_ids,
    },
    { enabled: !!usuarioId },
  );

  const isLoading = loadingTarefas || loadingSubtarefas;
  const tarefasList = tarefas ?? [];
  const subtarefasList = subtarefas ?? [];
  const hasItems = tarefasList.length > 0 || subtarefasList.length > 0;

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
            hideProjeto
            variant="visualizando"
          />
        </div>
        <AgendaViewSelector value={view} onChange={handleViewChange} hideColunas />
      </div>

      {view === "cards" && (
        <div>
          {isLoading ? (
            <div className={DENSE_CARD_GRID_CLASS}>
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-36 rounded-xl" />
              ))}
            </div>
          ) : !hasItems ? (
            <EmptyState onCreate={onCreate} />
          ) : (
            <div className="space-y-4">
              {tarefasList.length > 0 && (
                <TarefaCardsGrid
                  tarefas={tarefasList}
                  canEdit={canEdit}
                  canDeleteTarefa={canDeleteTarefa}
                  canToggleConcluida={canToggleConcluida}
                  onOpenTarefa={onOpenTarefa}
                  onDuplicate={(tarefa) => void handleDuplicate(tarefa)}
                  onMove={setMovingTarefa}
                  onDelete={onDelete}
                  onToggleConcluida={onToggleConcluida}
                  enableReorder={false}
                />
              )}
              {subtarefasList.length > 0 && (
                <div className="space-y-2">
                  {tarefasList.length > 0 && (
                    <h3 className="text-sm font-semibold text-muted-foreground">Subtarefas</h3>
                  )}
                  <div className={DENSE_CARD_GRID_CLASS}>
                    {subtarefasList.map((subtarefa) => (
                      <SubtarefaAgendaCard
                        key={subtarefa.id}
                        subtarefa={subtarefa}
                        onOpen={() => onOpenSubtarefa(subtarefa)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {view === "lista" && (
        <div>
          {isLoading ? (
            <div className="space-y-2 rounded-xl border p-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : !hasItems ? (
            <EmptyState onCreate={onCreate} />
          ) : (
            <div className="space-y-4">
              {tarefasList.length > 0 && (
                <TarefaListView
                  tarefas={tarefasList}
                  onOpenTarefa={onOpenTarefa}
                  onToggleConcluida={onToggleConcluida}
                  canToggleConcluida={canToggleConcluida}
                  canEdit={canEdit}
                  canDeleteTarefa={canDeleteTarefa}
                  onDuplicate={(tarefa) => void handleDuplicate(tarefa)}
                  onMove={setMovingTarefa}
                  onDelete={onDelete}
                  enableReorder={false}
                />
              )}
              {subtarefasList.length > 0 && (
                <div className="space-y-2">
                  {tarefasList.length > 0 && (
                    <h3 className="text-sm font-semibold text-muted-foreground">Subtarefas</h3>
                  )}
                  <ul className="space-y-2">
                    {subtarefasList.map((subtarefa) => (
                      <li key={subtarefa.id}>
                        <SubtarefaAgendaListRow
                          subtarefa={subtarefa}
                          onOpen={() => onOpenSubtarefa(subtarefa)}
                          onToggleConcluida={(concluida) =>
                            handleToggleSubtarefa(subtarefa, concluida)
                          }
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <MoverTarefaDialog
        tarefa={movingTarefa}
        open={!!movingTarefa}
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
  onCreate,
  message = "Nenhuma tarefa ou subtarefa para visualizar.",
}: {
  onCreate: () => void;
  message?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed p-12 text-center">
      <p className="text-muted-foreground">{message}</p>
      <Button variant="outline" className="mt-4 gap-2" onClick={onCreate}>
        <Plus className="h-4 w-4" />
        Nova tarefa
      </Button>
    </div>
  );
}
