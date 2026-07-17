import { ClipboardList, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/common/confirm-delete-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjetoFormDialog } from "@/components/projetos/projeto-form-dialog";
import { usePessoas } from "@/hooks/use-pessoas";
import { useProfile } from "@/hooks/use-profile";
import {
  useCreateProjeto,
  useDeleteProjeto,
  useProjetos,
  useUpdateProjeto,
} from "@/hooks/use-projetos";
import { useTarefas } from "@/hooks/use-tarefas";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import { DENSE_CARD_GRID_CLASS } from "@/lib/layout";
import { countAtividadesAbertasPorProjeto } from "@/services/projetos";
import type { ProjetoFormData, ProjetoWithResponsavel } from "@/types";
import { canDeleteProjeto, canManageProjeto, canManageProjetoMembros } from "@/utils/permissions";
import { PROJETO_STATUS_BADGE_CLASS, PROJETO_STATUS_LABELS } from "@/utils/projetos";
import { cn } from "@/lib/utils";

export function CadastroProjetosPanel({
  canManage,
  compactHeader = false,
}: {
  canManage: boolean;
  /** Oculta o título interno quando a página já exibe o cabeçalho. */
  compactHeader?: boolean;
}) {
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const { data: projetos, isLoading } = useProjetos(debouncedSearch);
  const { data: pessoas } = usePessoas();
  const { data: tarefas } = useTarefas();
  const createProjeto = useCreateProjeto();
  const updateProjeto = useUpdateProjeto();
  const deleteProjeto = useDeleteProjeto();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProjetoWithResponsavel | null>(null);
  const [deleting, setDeleting] = useState<ProjetoWithResponsavel | null>(null);
  const [deletingHasOpen, setDeletingHasOpen] = useState(false);

  const handleSearch = useMemo(() => {
    let timeout: ReturnType<typeof setTimeout>;
    return (value: string) => {
      setSearch(value);
      clearTimeout(timeout);
      timeout = setTimeout(() => setDebouncedSearch(value), 300);
    };
  }, []);

  const pessoasAtivas = useMemo(() => (pessoas ?? []).filter((p) => p.ativo), [pessoas]);

  const tarefasPorProjeto = useMemo(() => {
    const map = new Map<string, number>();
    for (const tarefa of tarefas ?? []) {
      if (!tarefa.projeto_id) continue;
      map.set(tarefa.projeto_id, (map.get(tarefa.projeto_id) ?? 0) + 1);
    }
    return map;
  }, [tarefas]);

  /** Estimativa na listagem (tarefas pai); a confirmação usa contagem completa no servidor. */
  const tarefasAbertasPorProjeto = useMemo(() => {
    const map = new Map<string, number>();
    for (const tarefa of tarefas ?? []) {
      if (!tarefa.projeto_id || tarefa.concluida) continue;
      map.set(tarefa.projeto_id, (map.get(tarefa.projeto_id) ?? 0) + 1);
    }
    return map;
  }, [tarefas]);

  const handleSave = async (data: ProjetoFormData) => {
    try {
      if (editing) {
        await updateProjeto.mutateAsync({ id: editing.id, data });
        toast.success("Projeto atualizado");
      } else {
        await createProjeto.mutateAsync(data);
        toast.success("Projeto criado");
      }
      setDialogOpen(false);
      setEditing(null);
    } catch (error) {
      toast.error("Erro ao salvar projeto", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteProjeto.mutateAsync(deleting.id);
      toast.success("Projeto excluído");
      setDeleting(null);
    } catch (error) {
      toast.error("Erro ao excluir projeto", {
        description: getSupabaseErrorMessage(error as Error),
      });
      throw error;
    }
  };

  const maybeShowDelete = (projeto: ProjetoWithResponsavel) => {
    return canManageProjeto(profile, projeto);
  };

  const canEditProjeto = (projeto: ProjetoWithResponsavel) =>
    canManageProjeto(profile, projeto);

  const requestDelete = async (projeto: ProjetoWithResponsavel) => {
    try {
      const abertas = await countAtividadesAbertasPorProjeto(projeto.id);
      const hasOpen = abertas > 0;
      if (!canDeleteProjeto(profile, projeto, hasOpen)) {
        toast.error("Sem permissão para excluir", {
          description: hasOpen
            ? "Com atividades abertas, apenas o administrador pode excluir o projeto."
            : "Apenas o criador, gestores ou administradores podem excluir este projeto.",
        });
        return;
      }
      setDeletingHasOpen(hasOpen);
      setDeleting(projeto);
    } catch (error) {
      toast.error("Erro ao verificar atividades do projeto", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {!compactHeader ? (
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Projetos</h2>
            <p className="text-sm text-muted-foreground">
              Agrupe tarefas relacionadas em projetos.
            </p>
          </div>
        ) : (
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              className="pl-9"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        )}
        {canManage && (
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
            className="shrink-0 gap-2"
          >
            <Plus className="h-4 w-4" />
            Novo projeto
          </Button>
        )}
      </div>

      {!compactHeader && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            className="pl-9"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
      )}

      {isLoading ? (
        <div className={DENSE_CARD_GRID_CLASS}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : !projetos?.length ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <p className="text-muted-foreground">Nenhum projeto cadastrado ainda.</p>
          {canManage && (
            <Button
              variant="outline"
              className="mt-4 gap-2"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Criar primeiro projeto
            </Button>
          )}
        </div>
      ) : (
        <div className={DENSE_CARD_GRID_CLASS}>
          {projetos.map((projeto) => {
            const tarefasCount = tarefasPorProjeto.get(projeto.id) ?? 0;
            const membrosCount = projeto.membros?.length ?? 0;
            const abertasEst = tarefasAbertasPorProjeto.get(projeto.id) ?? 0;
            const showDelete = maybeShowDelete(projeto);
            const canEdit = canEditProjeto(projeto);
            const canEditEquipe = canManageProjetoMembros(profile, projeto);
            return (
              <Card
                key={projeto.id}
                role="link"
                tabIndex={0}
                className="cursor-pointer transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() =>
                  navigate({
                    to: "/projetos/$projetoId",
                    params: { projetoId: projeto.id },
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate({
                      to: "/projetos/$projetoId",
                      params: { projetoId: projeto.id },
                    });
                  }
                }}
              >
                <CardHeader className="space-y-0 p-3 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1">
                        <CardTitle className="truncate text-sm font-semibold leading-snug">
                          {projeto.nome}
                        </CardTitle>
                        <Badge
                          variant="outline"
                          className={cn(
                            "px-1.5 py-0 text-[10px]",
                            PROJETO_STATUS_BADGE_CLASS[projeto.status],
                          )}
                        >
                          {PROJETO_STATUS_LABELS[projeto.status]}
                        </Badge>
                      </div>
                      {projeto.descricao && (
                        <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
                          {projeto.descricao}
                        </p>
                      )}
                    </div>
                    {(canEdit || showDelete) && (
                      <div
                        className="flex shrink-0 gap-0.5"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditing(projeto);
                              setDialogOpen(true);
                            }}
                            aria-label="Editar projeto"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {showDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              void requestDelete(projeto);
                            }}
                            aria-label="Excluir projeto"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 p-3 pt-0 text-xs text-muted-foreground">
                  <p className="truncate">
                    Criador: {projeto.criador?.nome_completo ?? "Não informado"}
                  </p>
                  <p className="truncate">
                    Responsável: {projeto.responsavel?.nome_completo ?? "Não definido"}
                  </p>
                  <p className="flex items-center gap-1">
                    <Users className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {membrosCount}{" "}
                      {membrosCount === 1 ? "pessoa na equipe" : "pessoas na equipe"}
                      {!canEditEquipe && " · somente leitura"}
                    </span>
                  </p>
                  <p className="flex items-center gap-1">
                    <ClipboardList className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {tarefasCount}{" "}
                      {tarefasCount === 1 ? "tarefa vinculada" : "tarefas vinculadas"}
                      {abertasEst > 0 ? ` · ${abertasEst} aberta(s)` : ""}
                    </span>
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {canManage && (
        <ProjetoFormDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditing(null);
          }}
          projeto={editing}
          pessoas={pessoasAtivas}
          onSubmit={handleSave}
          loading={createProjeto.isPending || updateProjeto.isPending}
          canManageEquipe={
            editing ? canManageProjetoMembros(profile, editing) : canManageProjetoMembros(profile)
          }
        />
      )}

      <ConfirmDeleteDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
            setDeletingHasOpen(false);
          }
        }}
        itemKind="projeto"
        itemName={deleting?.nome}
        description={
          deletingHasOpen
            ? `Excluir o projeto "${deleting?.nome}"? Há tarefas ou subtarefas abertas. Somente administradores podem concluir esta exclusão. Esta ação não pode ser desfeita.`
            : undefined
        }
        requireTypedConfirmation={deletingHasOpen ? "CONFIRMAR" : undefined}
        onConfirm={handleDelete}
      />
    </div>
  );
}
