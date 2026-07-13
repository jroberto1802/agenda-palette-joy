import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Columns3, LayoutGrid, List, Plus } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjetoEquipeAvatars } from "@/components/projetos/projeto-equipe-avatars";
import { ProjetoEquipeSheet } from "@/components/projetos/projeto-equipe-sheet";
import { TarefaCard } from "@/components/tarefas/tarefa-card";
import { TarefaFiltersBar } from "@/components/tarefas/tarefa-filters";
import { TarefaKanban } from "@/components/tarefas/tarefa-kanban";
import { TarefaListView } from "@/components/tarefas/tarefa-list-view";
import { TarefaPanelSheet } from "@/components/tarefas/tarefa-panel-sheet";
import { usePessoas } from "@/hooks/use-pessoas";
import { useProjeto, useProjetoMembros } from "@/hooks/use-projetos";
import { useProfile } from "@/hooks/use-profile";
import { useSetores } from "@/hooks/use-setores";
import {
  useSoftDeleteTarefa,
  useTarefas,
  useUpdateTarefaStatus,
} from "@/hooks/use-tarefas";
import { CARD_GRID_CLASS } from "@/lib/layout";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import type { TarefaFilters, TarefaStatus, TarefaWithRelations } from "@/types";
import { isAdmin, isGerente } from "@/utils/permissions";
import { PROJETO_STATUS_BADGE_CLASS, PROJETO_STATUS_LABELS } from "@/utils/projetos";
import { canEditTarefa, TAREFA_STATUS_LABELS } from "@/utils/tarefas";
import { cn } from "@/lib/utils";

const DEFAULT_FILTERS: TarefaFilters = {
  status: "all",
  prioridade: "all",
  setor_id: "all",
  projeto_id: "all",
  atribuido_a: "all",
  atribuido_ids: [],
  search: "",
  tag: "",
};

type ViewMode = "cards" | "lista" | "kanban";

export const Route = createFileRoute("/_authenticated/projetos/$projetoId")({
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

  const [filters, setFilters] = useState<TarefaFilters>({ ...DEFAULT_FILTERS });
  const [debouncedFilters, setDebouncedFilters] = useState<TarefaFilters>({
    ...DEFAULT_FILTERS,
  });
  const [view, setView] = useState<ViewMode>("cards");
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

  const handleFiltersChange = useMemo(() => {
    let timeout: ReturnType<typeof setTimeout>;
    return (next: TarefaFilters) => {
      setFilters(next);
      clearTimeout(timeout);
      timeout = setTimeout(() => setDebouncedFilters(next), 300);
    };
  }, []);

  const queryFilters = useMemo(() => {
    const base =
      view === "kanban"
        ? { ...debouncedFilters, status: "all" as const }
        : debouncedFilters;
    return { ...base, projeto_id: projetoId };
  }, [debouncedFilters, projetoId, view]);

  const { data: tarefas, isLoading: loadingTarefas } = useTarefas(queryFilters);

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
                Tarefas do projeto em cards, lista ou Kanban.
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

      <TarefaFiltersBar
        filters={filters}
        onChange={handleFiltersChange}
        setores={setores ?? []}
        projetos={[]}
        pessoas={pessoasEquipe}
        hideProjeto
      />

      <Tabs value={view} onValueChange={(value) => setView(value as ViewMode)}>
        <TabsList>
          <TabsTrigger value="cards" className="gap-2">
            <LayoutGrid className="h-4 w-4" />
            Cards
          </TabsTrigger>
          <TabsTrigger value="lista" className="gap-2">
            <List className="h-4 w-4" />
            Lista
          </TabsTrigger>
          <TabsTrigger value="kanban" className="gap-2">
            <Columns3 className="h-4 w-4" />
            Kanban
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cards" className="mt-4">
          {loadingTarefas ? (
            <div className={CARD_GRID_CLASS}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </div>
          ) : !tarefas?.length ? (
            <EmptyState onCreate={openCreate} />
          ) : (
            <div className={CARD_GRID_CLASS}>
              {tarefas.map((tarefa) => (
                <TarefaCard
                  key={tarefa.id}
                  tarefa={tarefa}
                  canEdit={canEdit(tarefa)}
                  canDelete={canDeleteTarefa(tarefa)}
                  onOpen={() => openTarefa(tarefa)}
                  onEdit={() => openTarefa(tarefa)}
                  onDelete={() => setDeleting(tarefa)}
                  onStatusChange={(status) => handleStatusChange(tarefa, status)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="lista" className="mt-4">
          {loadingTarefas ? (
            <div className="space-y-2 rounded-xl border p-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : !tarefas?.length ? (
            <EmptyState onCreate={openCreate} />
          ) : (
            <TarefaListView tarefas={tarefas} onOpenTarefa={openTarefa} />
          )}
        </TabsContent>

        <TabsContent value="kanban" className="mt-4">
          {loadingTarefas ? (
            <div className="flex gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[520px] min-w-[280px] flex-1 rounded-xl" />
              ))}
            </div>
          ) : !tarefas?.length ? (
            <EmptyState onCreate={openCreate} />
          ) : (
            <TarefaKanban
              tarefas={tarefas}
              onStatusChange={handleStatusChange}
              onOpenTarefa={openTarefa}
            />
          )}
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
        canManage={!!profile}
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

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-xl border border-dashed p-12 text-center">
      <p className="text-muted-foreground">Nenhuma tarefa vinculada a este projeto.</p>
      <Button variant="outline" className="mt-4 gap-2" onClick={onCreate}>
        <Plus className="h-4 w-4" />
        Criar primeira tarefa
      </Button>
    </div>
  );
}
