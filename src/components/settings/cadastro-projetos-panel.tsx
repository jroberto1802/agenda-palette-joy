import { ClipboardList, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjetoFormDialog } from "@/components/projetos/projeto-form-dialog";
import { usePessoas } from "@/hooks/use-pessoas";
import {
  useCreateProjeto,
  useDeleteProjeto,
  useProjetos,
  useUpdateProjeto,
} from "@/hooks/use-projetos";
import { useTarefas } from "@/hooks/use-tarefas";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import { CARD_GRID_CLASS } from "@/lib/layout";
import type { ProjetoFormData, ProjetoWithResponsavel } from "@/types";
import { PROJETO_STATUS_BADGE_CLASS, PROJETO_STATUS_LABELS } from "@/utils/projetos";
import { cn } from "@/lib/utils";

export function CadastroProjetosPanel({
  canManage,
  canDelete,
}: {
  canManage: boolean;
  canDelete: boolean;
}) {
  const navigate = useNavigate();
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

  const tarefasAbertasPorProjeto = useMemo(() => {
    const map = new Map<string, number>();
    for (const tarefa of tarefas ?? []) {
      if (!tarefa.projeto_id || tarefa.status === "concluida") continue;
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
    }
  };

  const requestDelete = (projeto: ProjetoWithResponsavel) => {
    const abertas = tarefasAbertasPorProjeto.get(projeto.id) ?? 0;
    if (abertas > 0) {
      toast.error("Não é possível excluir o projeto", {
        description:
          "Há tarefas em aberto vinculadas a este projeto. Conclua ou mova as tarefas antes de excluir.",
      });
      return;
    }
    setDeleting(projeto);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Projetos</h2>
          <p className="text-sm text-muted-foreground">
            Agrupe tarefas relacionadas em projetos.
          </p>
        </div>
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

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome..."
          className="pl-9"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className={CARD_GRID_CLASS}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
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
        <div className={CARD_GRID_CLASS}>
          {projetos.map((projeto) => {
            const tarefasCount = tarefasPorProjeto.get(projeto.id) ?? 0;
            const membrosCount = projeto.membros?.length ?? 0;
            return (
              <Card
                key={projeto.id}
                className="cursor-pointer transition-colors hover:border-primary/40"
                onClick={() =>
                  navigate({
                    to: "/projetos/$projetoId",
                    params: { projetoId: projeto.id },
                  })
                }
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="truncate text-base">{projeto.nome}</CardTitle>
                        <Badge
                          variant="outline"
                          className={cn("text-xs", PROJETO_STATUS_BADGE_CLASS[projeto.status])}
                        >
                          {PROJETO_STATUS_LABELS[projeto.status]}
                        </Badge>
                      </div>
                      {projeto.descricao && (
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {projeto.descricao}
                        </p>
                      )}
                    </div>
                    {canManage && (
                      <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditing(projeto);
                            setDialogOpen(true);
                          }}
                          aria-label="Editar projeto"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => requestDelete(projeto)}
                            aria-label="Excluir projeto"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-muted-foreground">
                  <p>Responsável: {projeto.responsavel?.nome_completo ?? "Não definido"}</p>
                  <p className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {membrosCount} {membrosCount === 1 ? "pessoa na equipe" : "pessoas na equipe"}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <ClipboardList className="h-3.5 w-3.5" />
                    {tarefasCount} {tarefasCount === 1 ? "tarefa vinculada" : "tarefas vinculadas"}
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
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir projeto?</AlertDialogTitle>
            <AlertDialogDescription>
              O projeto &quot;{deleting?.nome}&quot; será removido permanentemente.
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
