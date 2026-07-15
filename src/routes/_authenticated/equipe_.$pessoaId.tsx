import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/common/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { isAdmin, isAdminOrGerente, isGerente } from "@/utils/permissions";
import { canEditTarefa, canToggleTarefaConclusao } from "@/utils/tarefas";

export const Route = createFileRoute("/_authenticated/equipe_/$pessoaId")({
  head: ({ params }) => ({
    meta: [
      { title: "Agenda da pessoa — CoreGestor" },
      {
        name: "description",
        content: `Agenda da pessoa ${params.pessoaId}.`,
      },
    ],
  }),
  component: EquipePessoaAgendaPage,
});

function EquipePessoaAgendaPage() {
  const { pessoaId } = Route.useParams();
  const { data: profile, isLoading: loadingProfile } = useProfile();
  const { data: pessoas, isLoading: loadingPessoas } = usePessoas();
  const { data: setores } = useSetores();
  const { data: projetos } = useProjetos();

  const [boardState, setBoardState] = useState<AgendaBoardState>(createAgendaBoardState);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelId, setPanelId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TarefaWithRelations | null>(null);

  const updateConclusao = useUpdateTarefaConclusao();
  const softDelete = useSoftDeleteTarefa();

  const canManage = isAdminOrGerente(profile);

  const pessoa = useMemo(
    () => (pessoas ?? []).find((p) => p.id === pessoaId) ?? null,
    [pessoas, pessoaId],
  );

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

  const openCreate = () => {
    setPanelId(null);
    setPanelOpen(true);
  };

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

  const scopedBoardState = useMemo(
    () => ({
      ...boardState,
      filters: {
        ...boardState.filters,
        atribuido_ids: [pessoaId],
        atribuido_a: "all" as const,
      },
      debouncedFilters: {
        ...boardState.debouncedFilters,
        atribuido_ids: [pessoaId],
        atribuido_a: "all" as const,
      },
    }),
    [boardState, pessoaId],
  );

  useEffect(() => {
    setBoardState(createAgendaBoardState());
  }, [pessoaId]);

  if (!loadingProfile && profile && !canManage) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="gap-2 px-0">
          <Link to="/equipe">
            <ArrowLeft className="h-4 w-4" />
            Voltar para Equipe
          </Link>
        </Button>
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          Apenas Administrador e Gestor podem visualizar a agenda de outras pessoas.
        </div>
      </div>
    );
  }

  if (loadingProfile || loadingPessoas) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!pessoa) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="gap-2 px-0">
          <Link to="/equipe">
            <ArrowLeft className="h-4 w-4" />
            Voltar para Equipe
          </Link>
        </Button>
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          Pessoa não encontrada.
        </div>
      </div>
    );
  }

  const cargoSetor = [pessoa.cargo, pessoa.setor?.nome].filter(Boolean).join(" · ");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" asChild className="gap-2 px-0">
            <Link to="/equipe">
              <ArrowLeft className="h-4 w-4" />
              Voltar para Equipe
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Agenda de {pessoa.nome_completo}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {cargoSetor
                ? `${cargoSetor}. Tarefas atribuídas em cards, lista ou colunas.`
                : "Tarefas atribuídas em cards, lista ou colunas."}
            </p>
          </div>
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
        canToggleConcluida={canToggleConcluida}
        onOpenTarefa={openTarefa}
        onCreate={openCreate}
        onToggleConcluida={handleToggleConcluida}
        onDelete={setDeleting}
      />

      <TarefaPanelSheet
        tarefaId={panelId}
        open={panelOpen}
        onOpenChange={(open) => {
          setPanelOpen(open);
          if (!open) setPanelId(null);
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
