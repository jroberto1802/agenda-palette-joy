import { createFileRoute } from "@tanstack/react-router";
import { LayoutGrid, List, Plus } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TarefaCard } from "@/components/tarefas/tarefa-card";
import { TarefaFiltersBar } from "@/components/tarefas/tarefa-filters";
import { TarefaKanban } from "@/components/tarefas/tarefa-kanban";
import { TarefaPanelSheet } from "@/components/tarefas/tarefa-panel-sheet";
import { usePessoas } from "@/hooks/use-pessoas";
import { useProjetos } from "@/hooks/use-projetos";
import { useProfile } from "@/hooks/use-profile";
import { useSetores } from "@/hooks/use-setores";
import {
  useSoftDeleteTarefa,
  useTarefas,
  useUpdateTarefaStatus,
} from "@/hooks/use-tarefas";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import type { Profile, TarefaFilters, TarefaStatus, TarefaWithRelations } from "@/types";
import { isAdmin, isGerente } from "@/utils/permissions";
import { canEditTarefa, TAREFA_STATUS_LABELS } from "@/utils/tarefas";

const DEFAULT_FILTERS: TarefaFilters = {
  status: "all",
  prioridade: "all",
  setor_id: "all",
  projeto_id: "all",
  atribuido_a: "all",
  search: "",
  tag: "",
};

type AgendaTab = "minha" | "geral";

type AgendaTabState = {
  filters: TarefaFilters;
  debouncedFilters: TarefaFilters;
  view: "lista" | "kanban";
};

function createTabState(): AgendaTabState {
  return {
    filters: { ...DEFAULT_FILTERS },
    debouncedFilters: { ...DEFAULT_FILTERS },
    view: "lista",
  };
}

export const Route = createFileRoute("/_authenticated/tarefas")({
  head: () => ({
    meta: [
      { title: "Agenda — CoreGestor" },
      { name: "description", content: "Minha agenda e visão geral de tarefas da empresa." },
    ],
  }),
  component: AgendaPage,
});

function AgendaPage() {
  const { data: profile } = useProfile();
  const { data: setores } = useSetores();
  const { data: projetos } = useProjetos();
  const { data: pessoas } = usePessoas();

  const [agendaTab, setAgendaTab] = useState<AgendaTab>("minha");
  const [minhaTab, setMinhaTab] = useState<AgendaTabState>(createTabState);
  const [geralTab, setGeralTab] = useState<AgendaTabState>(createTabState);

  const [panelOpen, setPanelOpen] = useState(false);
  const [panelId, setPanelId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TarefaWithRelations | null>(null);

  const updateStatus = useUpdateTarefaStatus();
  const softDelete = useSoftDeleteTarefa();

  const pessoasAtivas = useMemo(
    () => (pessoas ?? []).filter((p) => p.ativo),
    [pessoas],
  );

  const canDeleteTarefa = (tarefa: TarefaWithRelations) => {
    if (isAdmin(profile)) return true;
    return tarefa.criado_por === profile?.id;
  };

  const canEdit = (tarefa: TarefaWithRelations) =>
    canEditTarefa(tarefa, profile?.id, isAdmin(profile), isGerente(profile), profile?.setor_id);

  const openCreate = () => {
    setPanelId(null);
    setPanelOpen(true);
  };

  const openTarefa = (tarefa: TarefaWithRelations) => {
    setPanelId(tarefa.id);
    setPanelOpen(true);
  };

  const handleStatusChange = async (tarefa: TarefaWithRelations, status: TarefaStatus) => {
    try {
      await updateStatus.mutateAsync({ id: tarefa.id, status });
      toast.success(`Status alterado para "${TAREFA_STATUS_LABELS[status]}"`);
    } catch (error) {
      toast.error("Erro ao alterar status", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await softDelete.mutateAsync(deleting.id);
      toast.success("Tarefa excluída");
      setDeleting(null);
      if (panelId === deleting.id) {
        setPanelOpen(false);
        setPanelId(null);
      }
    } catch (error) {
      toast.error("Erro ao excluir tarefa", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Suas tarefas e a visão geral da empresa em lista ou Kanban.
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0 gap-2">
          <Plus className="h-4 w-4" />
          Nova tarefa
        </Button>
      </div>

      <Tabs value={agendaTab} onValueChange={(value) => setAgendaTab(value as AgendaTab)}>
        <TabsList>
          <TabsTrigger value="minha">Minha Agenda</TabsTrigger>
          <TabsTrigger value="geral">Agenda Geral</TabsTrigger>
        </TabsList>

        <TabsContent value="minha" className="mt-4 space-y-4">
          <AgendaTabPanel
            mode="minha"
            profile={profile}
            tabState={minhaTab}
            onTabStateChange={setMinhaTab}
            setores={setores ?? []}
            projetos={projetos ?? []}
            pessoas={pessoasAtivas}
            canEdit={canEdit}
            canDeleteTarefa={canDeleteTarefa}
            onOpenTarefa={openTarefa}
            onCreate={openCreate}
            onStatusChange={handleStatusChange}
            onDelete={setDeleting}
          />
        </TabsContent>

        <TabsContent value="geral" className="mt-4 space-y-4">
          <AgendaTabPanel
            mode="geral"
            profile={profile}
            tabState={geralTab}
            onTabStateChange={setGeralTab}
            setores={setores ?? []}
            projetos={projetos ?? []}
            pessoas={pessoasAtivas}
            canEdit={canEdit}
            canDeleteTarefa={canDeleteTarefa}
            onOpenTarefa={openTarefa}
            onCreate={openCreate}
            onStatusChange={handleStatusChange}
            onDelete={setDeleting}
          />
        </TabsContent>
      </Tabs>

      <TarefaPanelSheet
        tarefaId={panelId}
        open={panelOpen}
        onOpenChange={(open) => {
          setPanelOpen(open);
          if (!open) setPanelId(null);
        }}
        onSaved={(id) => setPanelId(id)}
      />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              A tarefa &quot;{deleting?.titulo}&quot; será removida da listagem (exclusão lógica).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AgendaTabPanel({
  mode,
  profile,
  tabState,
  onTabStateChange,
  setores,
  projetos,
  pessoas,
  canEdit,
  canDeleteTarefa,
  onOpenTarefa,
  onCreate,
  onStatusChange,
  onDelete,
}: {
  mode: AgendaTab;
  profile: Profile | null | undefined;
  tabState: AgendaTabState;
  onTabStateChange: (state: AgendaTabState) => void;
  setores: Parameters<typeof TarefaFiltersBar>[0]["setores"];
  projetos: Parameters<typeof TarefaFiltersBar>[0]["projetos"];
  pessoas: Parameters<typeof TarefaFiltersBar>[0]["pessoas"];
  canEdit: (tarefa: TarefaWithRelations) => boolean;
  canDeleteTarefa: (tarefa: TarefaWithRelations) => boolean;
  onOpenTarefa: (tarefa: TarefaWithRelations) => void;
  onCreate: () => void;
  onStatusChange: (tarefa: TarefaWithRelations, status: TarefaStatus) => void;
  onDelete: (tarefa: TarefaWithRelations) => void;
}) {
  const { filters, debouncedFilters, view } = tabState;
  const tabStateRef = useRef(tabState);
  tabStateRef.current = tabState;

  const handleFiltersChange = useMemo(() => {
    let timeout: ReturnType<typeof setTimeout>;
    return (next: TarefaFilters) => {
      onTabStateChange({
        ...tabStateRef.current,
        filters: next,
      });
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        onTabStateChange({
          ...tabStateRef.current,
          filters: next,
          debouncedFilters: next,
        });
      }, 300);
    };
  }, [onTabStateChange]);

  const queryFilters = useMemo(() => {
    const base =
      view === "kanban"
        ? { ...debouncedFilters, status: "all" as const }
        : debouncedFilters;

    if (mode === "minha" && profile?.id) {
      return { ...base, atribuido_a: profile.id };
    }

    return base;
  }, [debouncedFilters, mode, profile?.id, view]);

  const { data: tarefas, isLoading } = useTarefas(queryFilters);

  const emptyMessage =
    mode === "minha"
      ? "Nenhuma tarefa atribuída a você."
      : "Nenhuma tarefa encontrada.";

  return (
    <>
      <TarefaFiltersBar
        filters={filters}
        onChange={handleFiltersChange}
        setores={setores}
        projetos={projetos}
        pessoas={pessoas}
        hideResponsavel={mode === "minha"}
      />

      <Tabs
        value={view}
        onValueChange={(value) =>
          onTabStateChange({
            ...tabState,
            view: value as "lista" | "kanban",
          })
        }
      >
        <TabsList>
          <TabsTrigger value="lista" className="gap-2">
            <List className="h-4 w-4" />
            Lista
          </TabsTrigger>
          <TabsTrigger value="kanban" className="gap-2">
            <LayoutGrid className="h-4 w-4" />
            Kanban
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="mt-4">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </div>
          ) : !tarefas?.length ? (
            <EmptyState message={emptyMessage} onCreate={onCreate} />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
    </>
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
