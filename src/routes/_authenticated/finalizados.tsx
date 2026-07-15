import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/common/confirm-delete-dialog";
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
import { useSoftDeleteTarefa, useUpdateTarefaConclusao } from "@/hooks/use-tarefas";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import type { TarefaWithRelations } from "@/types";
import { isAdmin, isGerente } from "@/utils/permissions";
import { canEditTarefa } from "@/utils/tarefas";

type FinalizadosSearch = {
  tarefaId?: string;
};

export const Route = createFileRoute("/_authenticated/finalizados")({
  validateSearch: (search: Record<string, unknown>): FinalizadosSearch => ({
    tarefaId: typeof search.tarefaId === "string" ? search.tarefaId : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Finalizados — CoreGestor" },
      {
        name: "description",
        content: "Tarefas concluídas com filtros dedicados.",
      },
    ],
  }),
  component: FinalizadosPage,
});

function FinalizadosPage() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const { data: profile } = useProfile();
  const { data: setores } = useSetores();
  const { data: projetos } = useProjetos();
  const { data: pessoas } = usePessoas();

  const [boardState, setBoardState] = useState<AgendaBoardState>(() =>
    createAgendaBoardState({ somente_finalizadas: true }),
  );
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelId, setPanelId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TarefaWithRelations | null>(null);

  useEffect(() => {
    if (!search.tarefaId) return;
    setPanelId(search.tarefaId);
    setPanelOpen(true);
  }, [search.tarefaId]);

  // Garante que a aba Colunas não fique selecionada neste menu.
  useEffect(() => {
    if (boardState.view === "colunas" || (boardState.view as string) === "kanban") {
      setBoardState((prev) => ({ ...prev, view: "cards" }));
    }
  }, [boardState.view]);

  const updateConclusao = useUpdateTarefaConclusao();
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

  const openTarefa = (tarefa: TarefaWithRelations) => {
    setPanelId(tarefa.id);
    setPanelOpen(true);
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
      throw error;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Finalizados</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tarefas concluídas dos projetos e setores aos quais você tem acesso.
        </p>
      </div>

      <TarefaAgendaBoard
        state={boardState}
        onStateChange={setBoardState}
        setores={setores ?? []}
        projetos={projetos ?? []}
        pessoas={pessoasAtivas}
        somenteFinalizadas
        hideCreate
        emptyMessage="Nenhuma tarefa finalizada encontrada com os filtros atuais."
        canEdit={canEdit}
        canDeleteTarefa={canDeleteTarefa}
        onOpenTarefa={openTarefa}
        onCreate={() => undefined}
        onToggleConcluida={handleToggleConcluida}
        onDelete={setDeleting}
      />

      <TarefaPanelSheet
        tarefaId={panelId}
        open={panelOpen}
        onOpenChange={(open) => {
          setPanelOpen(open);
          if (!open) {
            setPanelId(null);
            if (search.tarefaId) {
              navigate({
                to: "/finalizados",
                search: {},
                replace: true,
              });
            }
          }
        }}
        onSaved={(id) => setPanelId(id)}
      />

      <ConfirmDeleteDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        itemKind="tarefa"
        itemName={deleting?.titulo}
        description={
          deleting
            ? `Excluir a tarefa "${deleting.titulo}"? Ela será removida da listagem (exclusão lógica). Esta ação não pode ser desfeita.`
            : undefined
        }
        onConfirm={handleDelete}
      />
    </div>
  );
}
