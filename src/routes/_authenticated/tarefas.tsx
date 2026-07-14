import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import type { TarefaStatus, TarefaWithRelations } from "@/types";
import { isAdmin, isGerente } from "@/utils/permissions";
import { canEditTarefa, TAREFA_STATUS_LABELS } from "@/utils/tarefas";

type AgendaSearch = {
  tarefaId?: string;
  aba?: "comentarios" | "anexos";
  comentarioId?: string;
};

export const Route = createFileRoute("/_authenticated/tarefas")({
  validateSearch: (search: Record<string, unknown>): AgendaSearch => ({
    tarefaId: typeof search.tarefaId === "string" ? search.tarefaId : undefined,
    aba: search.aba === "comentarios" || search.aba === "anexos" ? search.aba : undefined,
    comentarioId: typeof search.comentarioId === "string" ? search.comentarioId : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Agenda — CoreGestor" },
      { name: "description", content: "Sua agenda pessoal de tarefas." },
    ],
  }),
  component: AgendaPage,
});

function AgendaPage() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const { data: profile } = useProfile();
  const { data: setores } = useSetores();
  const { data: projetos } = useProjetos();
  const { data: pessoas } = usePessoas();

  const [boardState, setBoardState] = useState<AgendaBoardState>(createAgendaBoardState);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelId, setPanelId] = useState<string | null>(null);
  const [panelAba, setPanelAba] = useState<"comentarios" | "anexos" | undefined>();
  const [highlightComentarioId, setHighlightComentarioId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TarefaWithRelations | null>(null);

  useEffect(() => {
    if (!search.tarefaId) return;
    setPanelId(search.tarefaId);
    setPanelAba(search.aba);
    setHighlightComentarioId(search.comentarioId ?? null);
    setPanelOpen(true);
  }, [search.tarefaId, search.aba, search.comentarioId]);

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
    setPanelAba(undefined);
    setHighlightComentarioId(null);
    setPanelOpen(true);
  };

  const openTarefa = (tarefa: TarefaWithRelations) => {
    setPanelId(tarefa.id);
    setPanelAba(undefined);
    setHighlightComentarioId(null);
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

  /** Escopo fixo: apenas tarefas do usuário logado como responsável. */
  const scopedBoardState = useMemo(() => {
    if (!profile?.id) return boardState;
    return {
      ...boardState,
      filters: {
        ...boardState.filters,
        atribuido_ids: [profile.id],
        atribuido_a: "all" as const,
      },
      debouncedFilters: {
        ...boardState.debouncedFilters,
        atribuido_ids: [profile.id],
        atribuido_a: "all" as const,
      },
    };
  }, [boardState, profile?.id]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Suas tarefas atribuídas em cards, lista ou Kanban.
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0 gap-2">
          <Plus className="h-4 w-4" />
          Nova tarefa
        </Button>
      </div>

      <TarefaAgendaBoard
        state={scopedBoardState}
        onStateChange={(next) => {
          setBoardState({
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
        }}
        setores={setores ?? []}
        projetos={projetos ?? []}
        pessoas={pessoasAtivas}
        hideResponsavel
        emptyMessage="Nenhuma tarefa atribuída a você."
        canEdit={canEdit}
        canDeleteTarefa={canDeleteTarefa}
        onOpenTarefa={openTarefa}
        onCreate={openCreate}
        onStatusChange={handleStatusChange}
        onDelete={setDeleting}
      />

      <TarefaPanelSheet
        tarefaId={panelId}
        open={panelOpen}
        onOpenChange={(open) => {
          setPanelOpen(open);
          if (!open) {
            setPanelId(null);
            setPanelAba(undefined);
            setHighlightComentarioId(null);
            if (search.tarefaId || search.aba || search.comentarioId) {
              navigate({
                to: "/tarefas",
                search: {},
                replace: true,
              });
            }
          }
        }}
        onSaved={(id) => setPanelId(id)}
        initialAba={panelAba}
        highlightComentarioId={highlightComentarioId}
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
