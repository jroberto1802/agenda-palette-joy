import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createAgendaBoardState,
  TarefaAgendaBoard,
  type AgendaBoardState,
} from "@/components/tarefas/tarefa-agenda-board";
import { TarefaPanelSheet } from "@/components/tarefas/tarefa-panel-sheet";
import { usePessoas } from "@/hooks/use-pessoas";
import { useProjetos } from "@/hooks/use-projetos";
import { useProfile } from "@/hooks/use-profile";
import { useSetores } from "@/hooks/use-setores";
import { useSoftDeleteTarefa, useUpdateTarefaStatus } from "@/hooks/use-tarefas";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import type { Profile, TarefaStatus, TarefaWithRelations } from "@/types";
import { isAdmin, isGerente } from "@/utils/permissions";
import { canEditTarefa, TAREFA_STATUS_LABELS } from "@/utils/tarefas";

type AgendaTab = "minha" | "geral";

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
  const [minhaTab, setMinhaTab] = useState<AgendaBoardState>(createAgendaBoardState);
  const [geralTab, setGeralTab] = useState<AgendaBoardState>(createAgendaBoardState);

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
            Suas tarefas e a visão geral da empresa em cards, lista ou Kanban.
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0 gap-2">
          <Plus className="h-4 w-4" />
          Nova tarefa
        </Button>
      </div>

      <Tabs value={agendaTab} onValueChange={(value) => setAgendaTab(value as AgendaTab)}>
        <TabsList>
          <TabsTrigger value="minha">Minha agenda</TabsTrigger>
          <TabsTrigger value="geral">Agenda Geral</TabsTrigger>
        </TabsList>

        <TabsContent value="minha" className="mt-4">
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

        <TabsContent value="geral" className="mt-4">
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
  tabState: AgendaBoardState;
  onTabStateChange: (state: AgendaBoardState) => void;
  setores: Parameters<typeof TarefaAgendaBoard>[0]["setores"];
  projetos: Parameters<typeof TarefaAgendaBoard>[0]["projetos"];
  pessoas: Parameters<typeof TarefaAgendaBoard>[0]["pessoas"];
  canEdit: (tarefa: TarefaWithRelations) => boolean;
  canDeleteTarefa: (tarefa: TarefaWithRelations) => boolean;
  onOpenTarefa: (tarefa: TarefaWithRelations) => void;
  onCreate: () => void;
  onStatusChange: (tarefa: TarefaWithRelations, status: TarefaStatus) => void;
  onDelete: (tarefa: TarefaWithRelations) => void;
}) {
  const boardState = useMemo(() => {
    if (mode === "minha" && profile?.id) {
      return {
        ...tabState,
        filters: {
          ...tabState.filters,
          atribuido_ids: [profile.id],
          atribuido_a: "all" as const,
        },
        debouncedFilters: {
          ...tabState.debouncedFilters,
          atribuido_ids: [profile.id],
          atribuido_a: "all" as const,
        },
      };
    }
    return tabState;
  }, [mode, profile?.id, tabState]);

  return (
    <TarefaAgendaBoard
      state={boardState}
      onStateChange={(next) => {
        if (mode === "minha") {
          onTabStateChange({
            ...next,
            filters: {
              ...next.filters,
              atribuido_ids: [],
              atribuido_a: "all",
            },
            debouncedFilters: {
              ...next.debouncedFilters,
              atribuido_ids: [],
              atribuido_a: "all",
            },
          });
          return;
        }
        onTabStateChange(next);
      }}
      setores={setores}
      projetos={projetos}
      pessoas={pessoas}
      hideResponsavel={mode === "minha"}
      emptyMessage={
        mode === "minha"
          ? "Nenhuma tarefa atribuída a você."
          : "Nenhuma tarefa encontrada."
      }
      canEdit={canEdit}
      canDeleteTarefa={canDeleteTarefa}
      onOpenTarefa={onOpenTarefa}
      onCreate={onCreate}
      onStatusChange={onStatusChange}
      onDelete={onDelete}
    />
  );
}
