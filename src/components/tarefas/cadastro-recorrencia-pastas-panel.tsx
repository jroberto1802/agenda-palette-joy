import { ClipboardList, Pencil, Plus, RefreshCw, Search, Trash2, Users } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/common/confirm-delete-dialog";
import { ProfileAvatar } from "@/components/common/profile-avatar";
import { RecorrenciaPastaFormDialog } from "@/components/tarefas/recorrencia-pasta-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { usePessoas } from "@/hooks/use-pessoas";
import { useProfile } from "@/hooks/use-profile";
import {
  useCreateRecorrenciaPasta,
  useDeleteRecorrenciaPasta,
  useRecorrenciaPastas,
  useUpdateRecorrenciaPasta,
} from "@/hooks/use-recorrencia-pastas";
import { useSeriesModelos } from "@/hooks/use-tarefas";
import { DENSE_CARD_GRID_CLASS } from "@/lib/layout";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import {
  buildEntradasPasta,
  countOcorrenciasAbertasPorPasta,
  RECORRENCIA_ENTRADAS_SLUG,
  type RecorrenciaPasta,
  type RecorrenciaPastaFormData,
} from "@/services/recorrencia-pastas";
import {
  canCreateRecorrenciaPasta,
  canDeleteRecorrenciaPasta,
  canManageRecorrenciaPasta,
  canManageRecorrenciaPastaMembros,
  canSeeRecorrenciaPasta,
} from "@/utils/permissions";
import { isSerieModelo } from "@/utils/recorrencia";
import { cn } from "@/lib/utils";

export function CadastroRecorrenciaPastasPanel({
  compactHeader = false,
}: {
  compactHeader?: boolean;
}) {
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const { data: pastasRemotas, isLoading } = useRecorrenciaPastas(debouncedSearch);
  const { data: series } = useSeriesModelos();
  const { data: pessoas } = usePessoas();
  const createPasta = useCreateRecorrenciaPasta();
  const updatePasta = useUpdateRecorrenciaPasta();
  const deletePasta = useDeleteRecorrenciaPasta();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RecorrenciaPasta | null>(null);
  const [deleting, setDeleting] = useState<RecorrenciaPasta | null>(null);
  const [deletingHasOpen, setDeletingHasOpen] = useState(false);

  const canManage = canCreateRecorrenciaPasta(profile);

  const handleSearch = useMemo(() => {
    let timeout: ReturnType<typeof setTimeout>;
    return (value: string) => {
      setSearch(value);
      clearTimeout(timeout);
      timeout = setTimeout(() => setDebouncedSearch(value), 300);
    };
  }, []);

  const pessoasAtivas = useMemo(() => (pessoas ?? []).filter((p) => p.ativo), [pessoas]);

  const seriesPorPasta = useMemo(() => {
    const map = new Map<string, number>();
    for (const tarefa of series ?? []) {
      if (!isSerieModelo(tarefa)) continue;
      const key =
        (tarefa as { recorrencia_pasta_id?: string | null }).recorrencia_pasta_id ??
        RECORRENCIA_ENTRADAS_SLUG;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [series]);

  const pastasVisiveis = useMemo(() => {
    const entradas = buildEntradasPasta(profile?.id);
    const remotas = (pastasRemotas ?? []).filter((p) => canSeeRecorrenciaPasta(profile, p));
    const term = debouncedSearch.trim().toLocaleLowerCase("pt-BR");
    const showEntradas =
      !term ||
      entradas.nome.toLocaleLowerCase("pt-BR").includes(term) ||
      (entradas.descricao ?? "").toLocaleLowerCase("pt-BR").includes(term);
    return showEntradas ? [entradas, ...remotas] : remotas;
  }, [pastasRemotas, profile, debouncedSearch]);

  const openPasta = (pastaId: string) => {
    void navigate({
      to: "/recorrentes/$pastaId",
      params: { pastaId },
    });
  };

  const handleSave = async (data: RecorrenciaPastaFormData) => {
    try {
      if (editing) {
        await updatePasta.mutateAsync({ id: editing.id, data });
        toast.success("Pasta atualizada");
      } else {
        await createPasta.mutateAsync(data);
        toast.success("Pasta criada");
      }
      setDialogOpen(false);
      setEditing(null);
    } catch (error) {
      toast.error("Erro ao salvar pasta", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deletePasta.mutateAsync(deleting.id);
      toast.success("Pasta excluída. Séries voltaram para Entradas.");
      setDeleting(null);
    } catch (error) {
      toast.error("Erro ao excluir pasta", {
        description: getSupabaseErrorMessage(error as Error),
      });
      throw error;
    }
  };

  const requestDelete = async (pasta: RecorrenciaPasta) => {
    if (pasta.id === RECORRENCIA_ENTRADAS_SLUG) {
      toast.error("A pasta Entradas não pode ser excluída.");
      return;
    }
    try {
      const abertas = await countOcorrenciasAbertasPorPasta(pasta.id);
      const hasOpen = abertas > 0;
      if (!canDeleteRecorrenciaPasta(profile, pasta, hasOpen)) {
        toast.error("Sem permissão para excluir", {
          description: hasOpen
            ? "Com ocorrências abertas, apenas o administrador pode excluir a pasta."
            : "Apenas o criador, gestores participantes ou administradores podem excluir esta pasta.",
        });
        return;
      }
      setDeletingHasOpen(hasOpen);
      setDeleting(pasta);
    } catch (error) {
      toast.error("Erro ao verificar ocorrências da pasta", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {!compactHeader ? (
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Pastas</h2>
            <p className="text-sm text-muted-foreground">
              Organize séries recorrentes em pastas compartilháveis.
            </p>
          </div>
        ) : (
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar nome ou conteúdo..."
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
            Nova pasta
          </Button>
        )}
      </div>

      {!compactHeader && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar nome ou conteúdo..."
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
      ) : pastasVisiveis.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <p className="text-muted-foreground">Nenhuma pasta encontrada.</p>
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
              Criar primeira pasta
            </Button>
          )}
        </div>
      ) : (
        <div className={DENSE_CARD_GRID_CLASS}>
          {pastasVisiveis.map((pasta) => {
            const isEntradas = pasta.id === RECORRENCIA_ENTRADAS_SLUG;
            const seriesCount = seriesPorPasta.get(pasta.id) ?? 0;
            const membrosCount = pasta.membros?.length ?? 0;
            const canEdit = !isEntradas && canManageRecorrenciaPasta(profile, pasta);
            const showDelete = !isEntradas && canManageRecorrenciaPasta(profile, pasta);
            const canEditEquipe =
              !isEntradas && canManageRecorrenciaPastaMembros(profile, pasta);

            return (
              <Card
                key={pasta.id}
                role="link"
                tabIndex={0}
                className="cursor-pointer transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => openPasta(pasta.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openPasta(pasta.id);
                  }
                }}
              >
                <CardHeader className="space-y-0 p-3 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1">
                        <CardTitle className="truncate text-sm font-semibold leading-snug">
                          {pasta.nome}
                        </CardTitle>
                        {isEntradas && (
                          <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                            Padrão
                          </Badge>
                        )}
                      </div>
                      {pasta.descricao && (
                        <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
                          {pasta.descricao}
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
                              setEditing(pasta);
                              setDialogOpen(true);
                            }}
                            aria-label="Editar pasta"
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
                              void requestDelete(pasta);
                            }}
                            aria-label="Excluir pasta"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-1.5 p-3 pt-0 text-xs text-muted-foreground">
                  {!isEntradas && (
                    <div className="flex items-center gap-1.5">
                      <ProfileAvatar
                        name={pasta.criador?.nome_completo ?? "Não informado"}
                        avatarUrl={pasta.criador?.avatar_url}
                        className="h-4 w-4"
                        fallbackClassName="text-[8px]"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium leading-tight text-foreground">
                          {pasta.criador?.nome_completo ?? "Não informado"}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {format(new Date(pasta.created_at), "dd MMM yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  )}
                  <p className="truncate">
                    Responsável:{" "}
                    {isEntradas
                      ? "—"
                      : (pasta.responsavel?.nome_completo ?? "Não definido")}
                  </p>
                  <p className="flex items-center gap-1">
                    <Users className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {isEntradas
                        ? "Pasta padrão do sistema"
                        : `${membrosCount} ${
                            membrosCount === 1 ? "participante" : "participantes"
                          }${!canEditEquipe ? " · somente leitura" : ""}`}
                    </span>
                  </p>
                  <p className="flex items-center gap-1">
                    <ClipboardList className="h-3 w-3 shrink-0" />
                    <span className={cn("truncate inline-flex items-center gap-1")}>
                      <RefreshCw className="h-3 w-3 shrink-0 text-emerald-600" />
                      {seriesCount}{" "}
                      {seriesCount === 1 ? "série vinculada" : "séries vinculadas"}
                    </span>
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {canManage && (
        <RecorrenciaPastaFormDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditing(null);
          }}
          pasta={editing}
          pessoas={pessoasAtivas}
          onSubmit={handleSave}
          loading={createPasta.isPending || updatePasta.isPending}
          canManageEquipe={
            editing ? canManageRecorrenciaPastaMembros(profile, editing) : true
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
        itemKind="pasta"
        itemName={deleting?.nome}
        description={
          deletingHasOpen
            ? `Excluir a pasta "${deleting?.nome}"? Há ocorrências abertas nas séries. Somente administradores podem concluir esta exclusão. As séries voltam para Entradas.`
            : "As séries desta pasta voltam para Entradas. Nenhuma série será excluída."
        }
        requireTypedConfirmation={deletingHasOpen ? "CONFIRMAR" : undefined}
        onConfirm={handleDelete}
      />
    </div>
  );
}
