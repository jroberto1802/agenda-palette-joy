import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmSerieDeleteDialog } from "@/components/tarefas/confirm-serie-delete-dialog";
import {
  createAgendaBoardState,
  TarefaAgendaBoard,
  type AgendaBoardState,
} from "@/components/tarefas/tarefa-agenda-board";
import { TarefaPanelSheet } from "@/components/tarefas/tarefa-panel-sheet";
import { usePageHeader } from "@/contexts/page-header-context";
import { usePessoas } from "@/hooks/use-pessoas";
import { useProjetos } from "@/hooks/use-projetos";
import { useProfile } from "@/hooks/use-profile";
import { useSetores } from "@/hooks/use-setores";
import { useSoftDeleteTarefaComEscopo, useUpdateTarefaConclusao } from "@/hooks/use-tarefas";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import type { EscopoExclusaoSerie } from "@/services/tarefa-recorrencia";
import type { TarefaWithRelations } from "@/types";
import { readAgendaViewPreference } from "@/utils/agenda-view-preference";
import { isAdmin, isGerente } from "@/utils/permissions";
import { pertenceASerie } from "@/utils/recorrencia";
import { canEditTarefa, canToggleTarefaConclusao } from "@/utils/tarefas";

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
    createAgendaBoardState({ somente_finalizadas: true }, { scope: "finalizados" }),
  );
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelId, setPanelId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TarefaWithRelations | null>(null);

  useEffect(() => {
    if (!search.tarefaId) return;
    setPanelId(search.tarefaId);
    setPanelOpen(true);
  }, [search.tarefaId]);

  useEffect(() => {
    if (!profile?.id) return;
    const saved = readAgendaViewPreference(profile.id, "finalizados");
    const view = saved === "colunas" ? "cards" : saved;
    setBoardState((prev) => (prev.view === view ? prev : { ...prev, view }));
  }, [profile?.id]);

  const updateConclusao = useUpdateTarefaConclusao();
  const softDelete = useSoftDeleteTarefaComEscopo();

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

  const canToggleConcluida = (tarefa: TarefaWithRelations) =>
    canToggleTarefaConclusao(
      tarefa,
      profile?.id,
      isAdmin(profile),
      isGerente(profile),
      profile?.setor_id,
    );

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

  const handleDelete = async (escopo: EscopoExclusaoSerie) => {
    if (!deleting) return;
    try {
      await softDelete.mutateAsync({ id: deleting.id, escopo });
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

  usePageHeader({
    title: "Finalizados",
    subtitle: "Tarefas concluídas dos projetos e setores aos quais você tem acesso.",
  });

  return (
    <div className="space-y-6">
      <TarefaAgendaBoard
        state={boardState}
        onStateChange={setBoardState}
        setores={setores ?? []}
        projetos={projetos ?? []}
        pessoas={pessoasAtivas}
        somenteFinalizadas
        hideCreate
        preferenceScope="finalizados"
        preferenceUserId={profile?.id}
        emptyMessage="Nenhuma tarefa finalizada encontrada com os filtros atuais."
        canEdit={canEdit}
        canDeleteTarefa={canDeleteTarefa}
        canToggleConcluida={canToggleConcluida}
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

      <ConfirmSerieDeleteDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        itemName={deleting?.titulo}
        isSerie={!!deleting && pertenceASerie(deleting)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
