import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/common/confirm-delete-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjetoEquipeAvatars } from "@/components/projetos/projeto-equipe-avatars";
import { ProjetoEquipeSheet } from "@/components/projetos/projeto-equipe-sheet";
import {
  createAgendaBoardState,
  TarefaAgendaBoard,
  type AgendaBoardState,
} from "@/components/tarefas/tarefa-agenda-board";
import { TarefaPanelSheet } from "@/components/tarefas/tarefa-panel-sheet";
import { usePessoas } from "@/hooks/use-pessoas";
import { useProjeto, useProjetoMembros } from "@/hooks/use-projetos";
import { useProfile } from "@/hooks/use-profile";
import { useSetores } from "@/hooks/use-setores";
import { useSoftDeleteTarefa, useUpdateTarefaStatus } from "@/hooks/use-tarefas";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import type { TarefaStatus, TarefaWithRelations } from "@/types";
import { canManageProjetoMembros, isAdmin, isGerente } from "@/utils/permissions";
import { PROJETO_STATUS_BADGE_CLASS, PROJETO_STATUS_LABELS } from "@/utils/projetos";
import { canEditTarefa, TAREFA_STATUS_LABELS } from "@/utils/tarefas";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/projetos_/$projetoId")({
  head: () => ({
    meta: [{ title: "Projeto — CoreGestor" }],
  }),
  component: ProjetoDetailPage,
});

function ProjetoDetailPage() {
  const { projetoId } = Route.useParams();
  const { data: profile } = useProfile();
  const { data: projeto, isLoading: loadingProjeto } = useProjeto(projetoId);
  const { data: membros = [] } = useProjetoMembros(projetoId);
  const { data: setores } = useSetores();
  const { data: pessoas } = usePessoas();

  const [boardState, setBoardState] = useState<AgendaBoardState>(createAgendaBoardState);
  const [equipeOpen, setEquipeOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelId, setPanelId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TarefaWithRelations | null>(null);

  const updateStatus = useUpdateTarefaStatus();
  const softDelete = useSoftDeleteTarefa();

  const pessoasAtivas = useMemo(
    () => (pessoas ?? []).filter((p) => p.ativo),
    [pessoas],
  );

  const pessoasEquipe = useMemo(() => {
    const memberIds = new Set(membros.map((m) => m.id));
    return pessoasAtivas.filter((p) => memberIds.has(p.id));
  }, [pessoasAtivas, membros]);

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
      throw error;
    }
  };

  if (loadingProjeto) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-48 rounded-full" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (!projeto) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild className="gap-2 px-0">
          <Link to="/projetos">
            <ArrowLeft className="h-4 w-4" />
            Voltar para projetos
          </Link>
        </Button>
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          Projeto não encontrado.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Button variant="ghost" asChild className="mb-2 gap-2 px-0 text-muted-foreground">
          <Link to="/projetos">
            <ArrowLeft className="h-4 w-4" />
            Projetos
          </Link>
        </Button>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{projeto.nome}</h1>
                <Badge
                  variant="outline"
                  className={cn("text-xs", PROJETO_STATUS_BADGE_CLASS[projeto.status])}
                >
                  {PROJETO_STATUS_LABELS[projeto.status]}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Tarefas do projeto em cards, lista ou colunas.
              </p>
            </div>

            <ProjetoEquipeAvatars
              membros={membros}
              onClick={() => setEquipeOpen(true)}
            />
          </div>

          <Button onClick={openCreate} className="shrink-0 gap-2">
            <Plus className="h-4 w-4" />
            Nova tarefa
          </Button>
        </div>
      </div>

      <TarefaAgendaBoard
        state={boardState}
        onStateChange={setBoardState}
        setores={setores ?? []}
        projetos={[]}
        pessoas={pessoasEquipe}
        hideProjeto
        forceProjetoId={projetoId}
        emptyMessage="Nenhuma tarefa vinculada a este projeto."
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
          if (!open) setPanelId(null);
        }}
        onSaved={(id) => setPanelId(id)}
        defaultProjetoId={projetoId}
        lockProjeto
      />

      <ProjetoEquipeSheet
        open={equipeOpen}
        onOpenChange={setEquipeOpen}
        projetoId={projetoId}
        projetoNome={projeto.nome}
        membros={membros}
        pessoas={pessoasAtivas}
        canManage={canManageProjetoMembros(profile, projeto)}
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
