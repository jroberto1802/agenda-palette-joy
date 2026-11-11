import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmSerieDeleteDialog } from "@/components/tarefas/confirm-serie-delete-dialog";
import { AgendaEmBreveView } from "@/components/tarefas/agenda-em-breve-view";
import { AgendaHojeView } from "@/components/tarefas/agenda-hoje-view";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useSoftDeleteTarefaComEscopo, useUpdateTarefaConclusao } from "@/hooks/use-tarefas";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import type { EscopoExclusaoSerie } from "@/services/tarefa-recorrencia";
import type { SubtarefaAgendaItem, TarefaWithRelations } from "@/types";
import { localDateAtNoon, startOfTodayLocal } from "@/utils/agenda-datas";
import { readAgendaClassificarPreference } from "@/utils/agenda-classificar-preference";
import { readAgendaViewPreference } from "@/utils/agenda-view-preference";
import { canDeleteTarefa as podeExcluirTarefa, canViewAgendaOutraPessoa, isAdmin, isGerente } from "@/utils/permissions";
import { pertenceASerie } from "@/utils/recorrencia";
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

/** Abas da Agenda de outra pessoa (sem "Visualizando"; Colunas não se aplica). */
type EquipeAgendaTab = "hoje" | "em_breve" | "geral";

const TAB_TRIGGER_CLASS =
  "rounded-none border-b-2 border-transparent px-3 pb-2 pt-1 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none";

function EquipePessoaAgendaPage() {
  const { pessoaId } = Route.useParams();
  const { data: profile, isLoading: loadingProfile } = useProfile();
  const { data: pessoas, isLoading: loadingPessoas } = usePessoas();
  const { data: setores } = useSetores();
  const { data: projetos } = useProjetos();

  const [boardState, setBoardState] = useState<AgendaBoardState>(() =>
    createAgendaBoardState(undefined, { scope: "equipe" }),
  );
  const [agendaTab, setAgendaTab] = useState<EquipeAgendaTab>("hoje");
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelId, setPanelId] = useState<string | null>(null);
  const [panelSubtarefaId, setPanelSubtarefaId] = useState<string | null>(null);
  const [defaultDataInicio, setDefaultDataInicio] = useState<Date | null>(null);
  const [deleting, setDeleting] = useState<TarefaWithRelations | null>(null);

  const updateConclusao = useUpdateTarefaConclusao();
  const softDelete = useSoftDeleteTarefaComEscopo();

  useEffect(() => {
    if (!profile?.id) return;
    const saved = readAgendaViewPreference(profile.id, "equipe");
    const view = saved === "colunas" ? "cards" : saved;
    const classificar = readAgendaClassificarPreference(profile.id, "equipe");
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

  const canManage = canViewAgendaOutraPessoa(profile);

  const pessoa = useMemo(
    () => (pessoas ?? []).find((p) => p.id === pessoaId) ?? null,
    [pessoas, pessoaId],
  );

  const pessoasAtivas = useMemo(
    () => (pessoas ?? []).filter((p) => p.ativo),
    [pessoas],
  );

  const canDeleteTarefa = (tarefa: TarefaWithRelations) =>
    podeExcluirTarefa(profile, tarefa);

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
    setPanelSubtarefaId(null);
    setDefaultDataInicio(dataInicio ? localDateAtNoon(dataInicio) : null);
    setPanelOpen(true);
  };

  const openTarefa = (tarefa: TarefaWithRelations) => {
    setPanelId(tarefa.id);
    setPanelSubtarefaId(null);
    setDefaultDataInicio(null);
    setPanelOpen(true);
  };

  const openSubtarefa = (subtarefa: SubtarefaAgendaItem) => {
    setPanelId(subtarefa.tarefa_id);
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
    setBoardState(
      createAgendaBoardState(undefined, {
        scope: "equipe",
        userId: profile?.id,
      }),
    );
    // Ao trocar de pessoa, volta para a aba padrão.
    setAgendaTab("hoje");
  }, [pessoaId, profile?.id]);

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
                ? `${cargoSetor}. Tarefas atribuídas em cards ou lista.`
                : "Tarefas atribuídas em cards ou lista."}
            </p>
          </div>
        </div>
        <Button onClick={() => openCreate()} className="shrink-0 gap-2">
          <Plus className="h-4 w-4" />
          Nova tarefa
        </Button>
      </div>

      <Tabs
        value={agendaTab}
        onValueChange={(value) => setAgendaTab(value as EquipeAgendaTab)}
        className="min-w-0 space-y-4"
      >
        <TabsList className="h-9 w-full justify-start gap-1 bg-transparent p-0 sm:w-auto">
          <TabsTrigger value="hoje" className={TAB_TRIGGER_CLASS}>
            Hoje
          </TabsTrigger>
          <TabsTrigger value="em_breve" className={TAB_TRIGGER_CLASS}>
            Em breve
          </TabsTrigger>
          <TabsTrigger value="geral" className={TAB_TRIGGER_CLASS}>
            Agenda geral
          </TabsTrigger>
        </TabsList>

        {/* Hoje / Em breve: mesmos componentes da Minha Agenda, com a pessoa como dona
            da agenda. Permissões das ações e preferências são de quem consulta. */}
        <TabsContent value="hoje" className="mt-0 focus-visible:ring-0">
          <AgendaHojeView
            usuarioId={pessoaId}
            preferenceUserId={profile?.id}
            preferenceScope="equipe-hoje"
            setores={setores ?? []}
            projetos={projetos ?? []}
            onOpenTarefa={openTarefa}
            onOpenSubtarefa={openSubtarefa}
            onCreate={() => openCreate(startOfTodayLocal())}
            canEdit={canEdit}
            canDeleteTarefa={canDeleteTarefa}
            onDelete={setDeleting}
          />
        </TabsContent>

        <TabsContent value="em_breve" className="mt-0 focus-visible:ring-0">
          <AgendaEmBreveView
            usuarioId={pessoaId}
            preferenceUserId={profile?.id}
            preferenceScope="equipe-em-breve"
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
            hideColunas
            preferenceScope="equipe"
            preferenceUserId={profile?.id}
            emptyMessage="Nenhuma tarefa atribuída a esta pessoa."
            canEdit={canEdit}
            canDeleteTarefa={canDeleteTarefa}
            canToggleConcluida={canToggleConcluida}
            onOpenTarefa={openTarefa}
            onCreate={() => openCreate()}
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
            setPanelSubtarefaId(null);
            setDefaultDataInicio(null);
          }
        }}
        onSaved={(id) => setPanelId(id)}
        defaultDataInicio={defaultDataInicio}
        initialSubtarefaId={panelSubtarefaId}
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
