import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Plus, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmSerieDeleteDialog } from "@/components/tarefas/confirm-serie-delete-dialog";
import { MoverSeriePastaDialog } from "@/components/tarefas/mover-serie-pasta-dialog";
import { RecorrenciaPastaEquipeSheet } from "@/components/tarefas/recorrencia-pasta-equipe-sheet";
import { ProfileAvatar } from "@/components/common/profile-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjetoEquipeAvatars } from "@/components/projetos/projeto-equipe-avatars";
import {
  createAgendaBoardState,
  TarefaAgendaBoard,
  type AgendaBoardState,
} from "@/components/tarefas/tarefa-agenda-board";
import { TarefaPanelSheet } from "@/components/tarefas/tarefa-panel-sheet";
import { usePessoas } from "@/hooks/use-pessoas";
import {
  useRecorrenciaPasta,
  useRecorrenciaPastaMembros,
} from "@/hooks/use-recorrencia-pastas";
import { useProfile } from "@/hooks/use-profile";
import { useSetores } from "@/hooks/use-setores";
import { useSoftDeleteTarefaComEscopo } from "@/hooks/use-tarefas";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import {
  isRecorrenciaEntradasSlug,
  RECORRENCIA_ENTRADAS_SLUG,
} from "@/services/recorrencia-pastas";
import type { EscopoExclusaoSerie } from "@/services/tarefa-recorrencia";
import type { TarefaWithRelations } from "@/types";
import { readAgendaClassificarPreference } from "@/utils/agenda-classificar-preference";
import { readAgendaViewPreference } from "@/utils/agenda-view-preference";
import { canManageRecorrenciaPastaMembros, isAdmin, isGerente } from "@/utils/permissions";
import { pertenceASerie } from "@/utils/recorrencia";
import { canEditTarefa } from "@/utils/tarefas";

export const Route = createFileRoute("/_authenticated/recorrentes_/$pastaId")({
  head: () => ({
    meta: [{ title: "Pasta — Recorrentes — CoreGestor" }],
  }),
  component: RecorrentesPastaDetailPage,
});

function RecorrentesPastaDetailPage() {
  const { pastaId } = Route.useParams();
  const { data: profile } = useProfile();
  const { data: pasta, isLoading: loadingPasta } = useRecorrenciaPasta(pastaId);
  const { data: membros = [] } = useRecorrenciaPastaMembros(
    isRecorrenciaEntradasSlug(pastaId) ? undefined : pastaId,
  );
  const { data: setores } = useSetores();
  const { data: pessoas } = usePessoas();

  const [boardState, setBoardState] = useState<AgendaBoardState>(() =>
    createAgendaBoardState(undefined, { scope: "recorrentes-pasta" }),
  );
  const [equipeOpen, setEquipeOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelId, setPanelId] = useState<string | null>(null);
  const [creatingSerie, setCreatingSerie] = useState(false);
  const [deleting, setDeleting] = useState<TarefaWithRelations | null>(null);
  const [movingSerie, setMovingSerie] = useState<TarefaWithRelations | null>(null);

  const softDelete = useSoftDeleteTarefaComEscopo();
  const isEntradas = isRecorrenciaEntradasSlug(pastaId);

  useEffect(() => {
    if (!profile?.id) return;
    const saved = readAgendaViewPreference(profile.id, "recorrentes-pasta");
    const view = saved === "colunas" ? "cards" : saved;
    const classificar = readAgendaClassificarPreference(profile.id, "recorrentes-pasta");
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
    if (isEntradas) return pessoasAtivas;
    const memberIds = new Set(membros.map((m) => m.id));
    if (pasta?.criado_por) memberIds.add(pasta.criado_por);
    if (pasta?.responsavel_id) memberIds.add(pasta.responsavel_id);
    const filtered = pessoasAtivas.filter((p) => memberIds.has(p.id));
    return filtered.length > 0 ? filtered : pessoasAtivas;
  }, [pessoasAtivas, membros, pasta, isEntradas]);

  const canDeleteTarefa = (tarefa: TarefaWithRelations) => {
    if (isAdmin(profile)) return true;
    return tarefa.criado_por === profile?.id;
  };

  const canEdit = (tarefa: TarefaWithRelations) =>
    canEditTarefa(tarefa, profile?.id, isAdmin(profile), isGerente(profile), profile?.setor_id);

  const openCreate = () => {
    setPanelId(null);
    setCreatingSerie(true);
    setPanelOpen(true);
  };

  const openSerie = (tarefa: TarefaWithRelations) => {
    setPanelId(tarefa.id);
    setCreatingSerie(false);
    setPanelOpen(true);
  };

  const handleDelete = async (escopo: EscopoExclusaoSerie) => {
    if (!deleting) return;
    try {
      await softDelete.mutateAsync({ id: deleting.id, escopo });
      toast.success("Série excluída");
      setDeleting(null);
      if (panelId === deleting.id) {
        setPanelOpen(false);
        setPanelId(null);
      }
    } catch (error) {
      toast.error("Erro ao excluir série", {
        description: getSupabaseErrorMessage(error as Error),
      });
      throw error;
    }
  };

  if (loadingPasta) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-48 rounded-full" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (!pasta) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild className="gap-2 px-0">
          <Link to="/recorrentes">
            <ArrowLeft className="h-4 w-4" />
            Voltar para recorrentes
          </Link>
        </Button>
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          Pasta não encontrada.
        </div>
      </div>
    );
  }

  const defaultPastaId = isEntradas ? null : pasta.id;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Button variant="ghost" asChild className="mb-2 gap-2 px-0 text-muted-foreground">
          <Link to="/recorrentes">
            <ArrowLeft className="h-4 w-4" />
            Recorrentes
          </Link>
        </Button>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{pasta.nome}</h1>
                {isEntradas && (
                  <Badge variant="secondary" className="text-xs">
                    Padrão
                  </Badge>
                )}
              </div>
              {!isEntradas && (
                <div className="mt-3 flex items-center gap-2">
                  <ProfileAvatar
                    name={pasta.criador?.nome_completo ?? "Não informado"}
                    avatarUrl={pasta.criador?.avatar_url}
                    className="h-8 w-8"
                  />
                  <div>
                    <p className="text-sm font-medium">
                      {pasta.criador?.nome_completo ?? "Não informado"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(pasta.created_at), "dd 'de' MMMM 'de' yyyy", {
                        locale: ptBR,
                      })}
                      {pasta.responsavel?.nome_completo
                        ? ` · Responsável: ${pasta.responsavel.nome_completo}`
                        : ""}
                    </p>
                  </div>
                </div>
              )}
              {pasta.descricao ? (
                <p className="mt-2 text-sm text-muted-foreground">{pasta.descricao}</p>
              ) : null}
            </div>

            {!isEntradas && (
              <ProjetoEquipeAvatars
                membros={membros}
                onClick={() => setEquipeOpen(true)}
              />
            )}
            {isEntradas && (
              <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                Pasta padrão — séries sem pasta escolhida
              </p>
            )}
          </div>

          <Button onClick={openCreate} className="shrink-0 gap-2">
            <Plus className="h-4 w-4" />
            Nova série
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
        forceRecorrenciaPastaId={pastaId}
        somenteModelos
        preferenceScope="recorrentes-pasta"
        preferenceUserId={profile?.id}
        emptyMessage="Nenhuma série nesta pasta."
        createLabel="Criar primeira série"
        canEdit={canEdit}
        canDeleteTarefa={canDeleteTarefa}
        canToggleConcluida={() => false}
        onOpenTarefa={openSerie}
        onCreate={openCreate}
        onToggleConcluida={() => undefined}
        onDelete={setDeleting}
        onMoveSerie={setMovingSerie}
      />

      <TarefaPanelSheet
        tarefaId={creatingSerie ? null : panelId}
        open={panelOpen}
        serieModeloMode
        defaultRecorrenciaPastaId={defaultPastaId}
        onOpenChange={(open) => {
          setPanelOpen(open);
          if (!open) {
            setPanelId(null);
            setCreatingSerie(false);
          }
        }}
        onSaved={(id) => {
          setCreatingSerie(false);
          setPanelId(id);
          setPanelOpen(true);
        }}
      />

      {!isEntradas && pasta && (
        <RecorrenciaPastaEquipeSheet
          open={equipeOpen}
          onOpenChange={setEquipeOpen}
          pasta={pasta}
          membros={membros}
          pessoas={pessoasAtivas}
          canManage={canManageRecorrenciaPastaMembros(profile, pasta)}
        />
      )}

      <MoverSeriePastaDialog
        tarefa={movingSerie}
        open={!!movingSerie}
        onOpenChange={(open) => {
          if (!open) setMovingSerie(null);
        }}
        pastaAtualId={pastaId === RECORRENCIA_ENTRADAS_SLUG ? null : pastaId}
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
