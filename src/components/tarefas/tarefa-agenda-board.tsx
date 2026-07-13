import { Columns3, LayoutGrid, List, Plus } from "lucide-react";
import { useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TarefaCard } from "@/components/tarefas/tarefa-card";
import { TarefaFiltersBar } from "@/components/tarefas/tarefa-filters";
import { TarefaKanban } from "@/components/tarefas/tarefa-kanban";
import { TarefaListView } from "@/components/tarefas/tarefa-list-view";
import { useTarefas } from "@/hooks/use-tarefas";
import { CARD_GRID_CLASS } from "@/lib/layout";
import type {
  ProfileWithSetor,
  Projeto,
  SetorWithGerente,
  TarefaFilters,
  TarefaStatus,
  TarefaWithRelations,
} from "@/types";

export type AgendaViewMode = "cards" | "lista" | "kanban";

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
      status: "all",
      prioridade: "all",
      setor_id: "all",
      projeto_id: "all",
      atribuido_a: "all",
      atribuido_ids: [],
      search: "",
      tag: "",
      ...overrides,
    },
    debouncedFilters: {
      status: "all",
      prioridade: "all",
      setor_id: "all",
      projeto_id: "all",
      atribuido_a: "all",
      atribuido_ids: [],
      search: "",
      tag: "",
      ...overrides,
    },
    view: "cards",
  };
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
  onStatusChange,
  onDelete,
}: {
  state: AgendaBoardState;
  onStateChange: (state: AgendaBoardState) => void;
  setores: SetorWithGerente[];
  projetos: Pick<Projeto, "id" | "nome">[];
  pessoas: ProfileWithSetor[];
  hideProjeto?: boolean;
  hideResponsavel?: boolean;
  /** Sempre filtra por este projeto (tela de detalhe). */
  forceProjetoId?: string;
  emptyMessage: string;
  canEdit: (tarefa: TarefaWithRelations) => boolean;
  canDeleteTarefa: (tarefa: TarefaWithRelations) => boolean;
  onOpenTarefa: (tarefa: TarefaWithRelations) => void;
  onCreate: () => void;
  onStatusChange: (tarefa: TarefaWithRelations, status: TarefaStatus) => void;
  onDelete: (tarefa: TarefaWithRelations) => void;
}) {
  const { filters, debouncedFilters, view } = state;
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

  const queryFilters = useMemo(() => {
    const base =
      view === "kanban"
        ? { ...debouncedFilters, status: "all" as const }
        : debouncedFilters;

    if (forceProjetoId) {
      return { ...base, projeto_id: forceProjetoId };
    }

    return base;
  }, [debouncedFilters, forceProjetoId, view]);

  const { data: tarefas, isLoading } = useTarefas(queryFilters);

  return (
    <div className="space-y-4">
      <TarefaFiltersBar
        filters={filters}
        onChange={handleFiltersChange}
        setores={setores}
        projetos={projetos}
        pessoas={pessoas}
        hideProjeto={hideProjeto}
        hideResponsavel={hideResponsavel}
      />

      <Tabs
        value={view}
        onValueChange={(value) =>
          onStateChange({
            ...state,
            view: value as AgendaViewMode,
          })
        }
      >
        <TabsList>
          <TabsTrigger value="cards" className="gap-2">
            <LayoutGrid className="h-4 w-4" />
            Cards
          </TabsTrigger>
          <TabsTrigger value="lista" className="gap-2">
            <List className="h-4 w-4" />
            Lista
          </TabsTrigger>
          <TabsTrigger value="kanban" className="gap-2">
            <Columns3 className="h-4 w-4" />
            Kanban
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cards" className="mt-4">
          {isLoading ? (
            <div className={CARD_GRID_CLASS}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </div>
          ) : !tarefas?.length ? (
            <EmptyState message={emptyMessage} onCreate={onCreate} />
          ) : (
            <div className={CARD_GRID_CLASS}>
              {tarefas.map((tarefa) => (
                <TarefaCard
                  key={tarefa.id}
                  tarefa={tarefa}
                  canEdit={canEdit(tarefa)}
                  canDelete={canDeleteTarefa(tarefa)}
                  onOpen={() => onOpenTarefa(tarefa)}
                  onEdit={() => onOpenTarefa(tarefa)}
                  onDelete={() => onDelete(tarefa)}
                  onStatusChange={(status) => onStatusChange(tarefa, status)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="lista" className="mt-4">
          {isLoading ? (
            <div className="space-y-2 rounded-xl border p-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : !tarefas?.length ? (
            <EmptyState message={emptyMessage} onCreate={onCreate} />
          ) : (
            <TarefaListView tarefas={tarefas} onOpenTarefa={onOpenTarefa} />
          )}
        </TabsContent>

        <TabsContent value="kanban" className="mt-4">
          {isLoading ? (
            <div className="flex gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[520px] min-w-[280px] flex-1 rounded-xl" />
              ))}
            </div>
          ) : !tarefas?.length ? (
            <EmptyState message={emptyMessage} onCreate={onCreate} />
          ) : (
            <TarefaKanban
              tarefas={tarefas}
              onStatusChange={onStatusChange}
              onOpenTarefa={onOpenTarefa}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({ message, onCreate }: { message: string; onCreate: () => void }) {
  return (
    <div className="rounded-xl border border-dashed p-12 text-center">
      <p className="text-muted-foreground">{message}</p>
      <Button variant="outline" className="mt-4 gap-2" onClick={onCreate}>
        <Plus className="h-4 w-4" />
        Criar primeira tarefa
      </Button>
    </div>
  );
}
