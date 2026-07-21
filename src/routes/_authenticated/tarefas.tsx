import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/common/confirm-delete-dialog";
import { AgendaEmBreveView } from "@/components/tarefas/agenda-em-breve-view";
import { AgendaHojeView } from "@/components/tarefas/agenda-hoje-view";
import {
  AgendaVisualizandoView,
  createVisualizandoBoardState,
  type VisualizandoBoardState,
} from "@/components/tarefas/agenda-visualizando-view";
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
import { useSoftDeleteTarefa, useUpdateTarefaConclusao } from "@/hooks/use-tarefas";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import type { SubtarefaAgendaItem, TarefaWithRelations } from "@/types";
import { localDateAtNoon, startOfTodayLocal } from "@/utils/agenda-datas";
import { readAgendaViewPreference } from "@/utils/agenda-view-preference";
import { isAdmin, isGerente } from "@/utils/permissions";
import { canEditTarefa, canToggleTarefaConclusao } from "@/utils/tarefas";

type AgendaSearch = {
  tarefaId?: string;
  aba?: "comentarios" | "anexos";
  comentarioId?: string;
  subtarefaId?: string;
};

type AgendaTab = "hoje" | "em_breve" | "geral" | "visualizando";

export const Route = createFileRoute("/_authenticated/tarefas")({
  validateSearch: (search: Record<string, unknown>): AgendaSearch => ({
    tarefaId: typeof search.tarefaId === "string" ? search.tarefaId : undefined,
    aba: search.aba === "comentarios" || search.aba === "anexos" ? search.aba : undefined,
    comentarioId: typeof search.comentarioId === "string" ? search.comentarioId : undefined,
    subtarefaId: typeof search.subtarefaId === "string" ? search.subtarefaId : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Minha Agenda — CoreGestor" },
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

  const [agendaTab, setAgendaTab] = useState<AgendaTab>("hoje");
  const [boardState, setBoardState] = useState<AgendaBoardState>(() =>
    createAgendaBoardState(undefined, { scope: "agenda-geral" }),
  );
  const [visualizandoState, setVisualizandoState] = useState<VisualizandoBoardState>(() =>
    createVisualizandoBoardState(),
  );
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelId, setPanelId] = useState<string | null>(null);
  const [panelAba, setPanelAba] = useState<"comentarios" | "anexos" | undefined>();
  const [highlightComentarioId, setHighlightComentarioId] = useState<string | null>(null);
  const [panelSubtarefaId, setPanelSubtarefaId] = useState<string | null>(null);
  const [defaultDataInicio, setDefaultDataInicio] = useState<Date | null>(null);
  const [deleting, setDeleting] = useState<TarefaWithRelations | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    const geral = readAgendaViewPreference(profile.id, "agenda-geral");
    const visualizando = readAgendaViewPreference(profile.id, "agenda-visualizando");
    setBoardState((prev) => (prev.view === geral ? prev : { ...prev, view: geral }));
    setVisualizandoState((prev) =>
      prev.view === visualizando ? prev : { ...prev, view: visualizando },
    );
  }, [profile?.id]);

  useEffect(() => {
    if (!search.tarefaId) return;
    setPanelId(search.tarefaId);
    setPanelAba(search.aba);
    setHighlightComentarioId(search.comentarioId ?? null);
    setPanelSubtarefaId(search.subtarefaId ?? null);
    setDefaultDataInicio(null);
    setPanelOpen(true);
  }, [search.tarefaId, search.aba, search.comentarioId, search.subtarefaId]);

  const updateConclusao = useUpdateTarefaConclusao();
  const softDelete = useSoftDeleteTarefa();

  const pessoasAtivas = useMemo(
    () => (pessoas ?? []).filter((p) => p.ativo),
    [pessoas],
  );

  const defaultAtribuidoIds = useMemo(
    () => (profile?.id ? [profile.id] : undefined),
    [profile?.id],
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

  const openCreate = (dataInicio?: Date | null) => {
    setPanelId(null);
    setPanelAba(undefined);
    setHighlightComentarioId(null);
    setPanelSubtarefaId(null);
    setDefaultDataInicio(dataInicio ? localDateAtNoon(dataInicio) : null);
    setPanelOpen(true);
  };

  const openTarefa = (tarefa: TarefaWithRelations) => {
    setPanelId(tarefa.id);
    setPanelAba(undefined);
    setHighlightComentarioId(null);
    setPanelSubtarefaId(null);
    setDefaultDataInicio(null);
    setPanelOpen(true);
  };

  const openSubtarefa = (subtarefa: SubtarefaAgendaItem) => {
    setPanelId(subtarefa.tarefa_id);
    setPanelAba(undefined);
    setHighlightComentarioId(null);
    setPanelSubtarefaId(subtarefa.id);
    setDefaultDataInicio(null);
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
        <h1 className="text-2xl font-semibold tracking-tight">Minha Agenda</h1>
        <Button
          onClick={() =>
            openCreate(agendaTab === "hoje" ? startOfTodayLocal() : null)
          }
          className="shrink-0 gap-2"
        >
          <Plus className="h-4 w-4" />
          Nova tarefa
        </Button>
      </div>

      <Tabs
        value={agendaTab}
        onValueChange={(value) => setAgendaTab(value as AgendaTab)}
        className="space-y-4"
      >
        <TabsList className="h-9 w-full justify-start gap-1 bg-transparent p-0 sm:w-auto">
          <TabsTrigger
            value="hoje"
            className="rounded-none border-b-2 border-transparent px-3 pb-2 pt-1 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            Hoje
          </TabsTrigger>
          <TabsTrigger
            value="em_breve"
            className="rounded-none border-b-2 border-transparent px-3 pb-2 pt-1 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            Em breve
          </TabsTrigger>
          <TabsTrigger
            value="geral"
            className="rounded-none border-b-2 border-transparent px-3 pb-2 pt-1 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            Agenda geral
          </TabsTrigger>
          <TabsTrigger
            value="visualizando"
            className="rounded-none border-b-2 border-transparent px-3 pb-2 pt-1 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            Visualizando
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hoje" className="mt-0 focus-visible:ring-0">
          <AgendaHojeView
            usuarioId={profile?.id}
            setores={setores ?? []}
            projetos={projetos ?? []}
            onOpenTarefa={openTarefa}
            onOpenSubtarefa={openSubtarefa}
            onCreate={() => openCreate(startOfTodayLocal())}
          />
        </TabsContent>

        <TabsContent value="em_breve" className="mt-0 focus-visible:ring-0">
          <AgendaEmBreveView
            usuarioId={profile?.id}
            onOpenTarefa={openTarefa}
            onOpenSubtarefa={openSubtarefa}
            onCreateForDate={(date) => openCreate(date)}
          />
        </TabsContent>

        <TabsContent value="geral" className="mt-0 focus-visible:ring-0">
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
            preferenceScope="agenda-geral"
            preferenceUserId={profile?.id}
            emptyMessage="Nenhuma tarefa atribuída a você."
            canEdit={canEdit}
            canDeleteTarefa={canDeleteTarefa}
            canToggleConcluida={canToggleConcluida}
            onOpenTarefa={openTarefa}
            onCreate={() => openCreate(null)}
            onToggleConcluida={handleToggleConcluida}
            onDelete={setDeleting}
          />
        </TabsContent>

        <TabsContent value="visualizando" className="mt-0 focus-visible:ring-0">
          <AgendaVisualizandoView
            usuarioId={profile?.id}
            state={visualizandoState}
            onStateChange={setVisualizandoState}
            setores={setores ?? []}
            projetos={projetos ?? []}
            pessoas={pessoasAtivas}
            canEdit={canEdit}
            canDeleteTarefa={canDeleteTarefa}
            canToggleConcluida={canToggleConcluida}
            onOpenTarefa={openTarefa}
            onOpenSubtarefa={openSubtarefa}
            onCreate={() => openCreate(null)}
            onToggleConcluida={handleToggleConcluida}
            onDelete={setDeleting}
          />
        </TabsContent>
      </Tabs>

      <TarefaPanelSheet
        tarefaId={panelId}
        open={panelOpen}
        onOpenChange={(open) => {
          setPanelOpen(open);
          if (!open) {
            setPanelId(null);
            setPanelAba(undefined);
            setHighlightComentarioId(null);
            setPanelSubtarefaId(null);
            setDefaultDataInicio(null);
            if (search.tarefaId || search.aba || search.comentarioId || search.subtarefaId) {
              navigate({
                to: "/tarefas",
                search: {},
                replace: true,
              });
            }
          }
        }}
        onSaved={(id) => setPanelId(id)}
        defaultDataInicio={defaultDataInicio}
        defaultAtribuidoIds={defaultAtribuidoIds}
        initialAba={panelAba}
        highlightComentarioId={highlightComentarioId}
        initialSubtarefaId={panelSubtarefaId}
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
