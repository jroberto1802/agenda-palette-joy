import { createFileRoute } from "@tanstack/react-router";
import { LayoutGrid, List, Plus } from "lucide-react";
import { useMemo, useState } from "react";
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
import { useProfile } from "@/hooks/use-profile";
import { useSetores } from "@/hooks/use-setores";
import {
  useSoftDeleteTarefa,
  useTarefas,
  useUpdateTarefaStatus,
} from "@/hooks/use-tarefas";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import type { TarefaFilters, TarefaStatus, TarefaWithRelations } from "@/types";
import { isAdmin, isGerente } from "@/utils/permissions";
import { canEditTarefa, TAREFA_STATUS_LABELS } from "@/utils/tarefas";

export const Route = createFileRoute("/_authenticated/tarefas")({
  component: TarefasPage,
});

function TarefasPage() {
  const { data: profile } = useProfile();
  const { data: setores } = useSetores();
  const { data: pessoas } = usePessoas();

  const [view, setView] = useState<"lista" | "kanban">("lista");
  const [filters, setFilters] = useState<TarefaFilters>({
    status: "all",
    prioridade: "all",
    setor_id: "all",
    atribuido_a: "all",
    search: "",
    tag: "",
  });
  const [debouncedFilters, setDebouncedFilters] = useState(filters);

  const [panelOpen, setPanelOpen] = useState(false);
  const [panelId, setPanelId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TarefaWithRelations | null>(null);

  const kanbanFilters = useMemo(
    () => ({ ...debouncedFilters, status: "all" as const }),
    [debouncedFilters],
  );

  const { data: tarefas, isLoading } = useTarefas(
    view === "kanban" ? kanbanFilters : debouncedFilters,
  );
  const updateStatus = useUpdateTarefaStatus();
  const softDelete = useSoftDeleteTarefa();

  const pessoasAtivas = useMemo(
    () => (pessoas ?? []).filter((p) => p.ativo),
    [pessoas],
  );

  const handleFiltersChange = useMemo(() => {
    let timeout: ReturnType<typeof setTimeout>;
    return (next: TarefaFilters) => {
      setFilters(next);
      clearTimeout(timeout);
      timeout = setTimeout(() => setDebouncedFilters(next), 300);
    };
  }, []);

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tarefas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Lista, Kanban, comentários e subtarefas.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          Nova tarefa
        </Button>
      </div>

      <TarefaFiltersBar
        filters={filters}
        onChange={handleFiltersChange}
        setores={setores ?? []}
        pessoas={pessoasAtivas}
      />

      <Tabs value={view} onValueChange={(v) => setView(v as "lista" | "kanban")}>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </div>
          ) : !tarefas?.length ? (
            <EmptyState onCreate={openCreate} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tarefas.map((tarefa) => (
                <TarefaCard
                  key={tarefa.id}
                  tarefa={tarefa}
                  canEdit={canEdit(tarefa)}
                  canDelete={canDeleteTarefa(tarefa)}
                  onOpen={() => openTarefa(tarefa)}
                  onEdit={() => openTarefa(tarefa)}
                  onDelete={() => setDeleting(tarefa)}
                  onStatusChange={(status) => handleStatusChange(tarefa, status)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="kanban" className="mt-4">
          {isLoading ? (
            <div className="flex gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[520px] flex-1 min-w-[280px] rounded-xl" />
              ))}
            </div>
          ) : !tarefas?.length ? (
            <EmptyState onCreate={openCreate} />
          ) : (
            <TarefaKanban
              tarefas={tarefas}
              onStatusChange={handleStatusChange}
              onOpenTarefa={openTarefa}
            />
          )}
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

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-xl border border-dashed p-12 text-center">
      <p className="text-muted-foreground">Nenhuma tarefa encontrada.</p>
      <Button variant="outline" className="mt-4 gap-2" onClick={onCreate}>
        <Plus className="h-4 w-4" />
        Criar primeira tarefa
      </Button>
    </div>
  );
}
