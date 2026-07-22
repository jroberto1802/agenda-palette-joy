import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmSerieDeleteDialog } from "@/components/tarefas/confirm-serie-delete-dialog";
import { ProfileAvatar } from "@/components/common/profile-avatar";
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
import { useSoftDeleteTarefaComEscopo, useUpdateTarefaConclusao } from "@/hooks/use-tarefas";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import type { EscopoExclusaoSerie } from "@/services/tarefa-recorrencia";
import type { TarefaWithRelations } from "@/types";
import { readAgendaClassificarPreference } from "@/utils/agenda-classificar-preference";
import { readAgendaViewPreference } from "@/utils/agenda-view-preference";
import { canManageProjetoMembros, isAdmin, isGerente } from "@/utils/permissions";
import { pertenceASerie } from "@/utils/recorrencia";
import { PROJETO_STATUS_BADGE_CLASS, PROJETO_STATUS_LABELS } from "@/utils/projetos";
import { canEditTarefa, canToggleTarefaConclusao } from "@/utils/tarefas";
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

  const [boardState, setBoardState] = useState<AgendaBoardState>(() =>
    createAgendaBoardState(undefined, { scope: "projeto-detalhe" }),
  );
  const [equipeOpen, setEquipeOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelId, setPanelId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TarefaWithRelations | null>(null);

  const updateConclusao = useUpdateTarefaConclusao();
  const softDelete = useSoftDeleteTarefaComEscopo();

  useEffect(() => {
    if (!profile?.id) return;
    const saved = readAgendaViewPreference(profile.id, "projeto-detalhe");
    const view = saved === "colunas" ? "cards" : saved;
    const classificar = readAgendaClassificarPreference(profile.id, "projeto-detalhe");
    setBoardState((prev) => {
      if (prev.view === view && prev.filters.classificar === classificar) return prev;
      return {
        ...prev,
        view,
        filters: { ...prev.filters, classificar },
        debouncedFilters: { ...prev.debouncedFilters, classificar },
      };
    });
  }, [profile?.id]);

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
              <div className="mt-3 flex items-center gap-2">
                <ProfileAvatar
                  name={projeto.criador?.nome_completo ?? "Não informado"}
                  avatarUrl={projeto.criador?.avatar_url}
                  className="h-8 w-8"
                />
                <div>
                  <p className="text-sm font-medium">
                    {projeto.criador?.nome_completo ?? "Não informado"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(projeto.created_at), "dd 'de' MMMM 'de' yyyy", {
                      locale: ptBR,
                    })}
                    {projeto.responsavel?.nome_completo
                      ? ` · Responsável: ${projeto.responsavel.nome_completo}`
                      : ""}
                  </p>
                </div>
              </div>
              {projeto.descricao ? (
                <p className="mt-2 text-sm text-muted-foreground">{projeto.descricao}</p>
              ) : null}
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
        hideColunas
        forceProjetoId={projetoId}
        preferenceScope="projeto-detalhe"
        preferenceUserId={profile?.id}
        emptyMessage="Nenhuma tarefa vinculada a este projeto."
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
