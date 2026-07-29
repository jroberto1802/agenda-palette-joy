import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Folder,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/common/confirm-delete-dialog";
import { PessoasMultiSelect } from "@/components/common/pessoas-multi-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { usePessoas } from "@/hooks/use-pessoas";
import { useProfile } from "@/hooks/use-profile";
import {
  useCreateRecorrenciaPasta,
  useDeleteRecorrenciaPasta,
  useMoveSerieParaPasta,
  useRecorrenciaPastas,
  useRenameRecorrenciaPasta,
  useSetRecorrenciaPastaMembros,
} from "@/hooks/use-recorrencia-pastas";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import type { RecorrenciaPasta } from "@/services/recorrencia-pastas";
import type { TarefaWithRelations } from "@/types";
import {
  canCreateRecorrenciaPasta,
  canDeleteRecorrenciaPasta,
  canManageRecorrenciaPastaMembros,
  canSeeRecorrenciaPasta,
} from "@/utils/permissions";
import { formatRecorrencia, parseRecorrencia } from "@/utils/recorrencia";

type SerieComPasta = TarefaWithRelations & { recorrencia_pasta_id?: string | null };

function SerieCard({
  tarefa,
  pastas,
  onOpen,
  canMove,
}: {
  tarefa: SerieComPasta;
  pastas: RecorrenciaPasta[];
  onOpen: () => void;
  canMove: boolean;
}) {
  const moveSerie = useMoveSerieParaPasta();
  const rec = parseRecorrencia(tarefa.recorrencia);

  return (
    <div className="flex items-start gap-2 rounded-xl border bg-card p-3 shadow-sm">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-start gap-3 text-left transition-colors hover:opacity-90"
      >
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-medium">{tarefa.titulo}</p>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
              {rec ? formatRecorrencia(rec) : "Sem regra"}
            </Badge>
            {tarefa.criador && (
              <span className="truncate">
                {tarefa.criador.nome_completo}
                {tarefa.created_at
                  ? ` · ${format(new Date(tarefa.created_at), "dd MMM yyyy", { locale: ptBR })}`
                  : ""}
              </span>
            )}
          </div>
        </div>
      </button>
      {canMove && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Mover para pasta</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem
                  onClick={() =>
                    void moveSerie
                      .mutateAsync({ tarefaId: tarefa.id, pastaId: null })
                      .then(() => toast.success("Série movida para Entradas"))
                      .catch((e) =>
                        toast.error("Erro ao mover", {
                          description: getSupabaseErrorMessage(e as Error),
                        }),
                      )
                  }
                >
                  Entradas
                </DropdownMenuItem>
                {pastas.map((pasta) => (
                  <DropdownMenuItem
                    key={pasta.id}
                    onClick={() =>
                      void moveSerie
                        .mutateAsync({ tarefaId: tarefa.id, pastaId: pasta.id })
                        .then(() => toast.success(`Movida para ${pasta.nome}`))
                        .catch((e) =>
                          toast.error("Erro ao mover", {
                            description: getSupabaseErrorMessage(e as Error),
                          }),
                        )
                    }
                  >
                    {pasta.nome}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

function PastaSection({
  title,
  subtitle,
  series,
  pastas,
  onOpenSerie,
  pasta,
  onRename,
  onDelete,
  onMembros,
}: {
  title: string;
  subtitle?: string;
  series: SerieComPasta[];
  pastas: RecorrenciaPasta[];
  onOpenSerie: (id: string) => void;
  pasta?: RecorrenciaPasta;
  onRename?: () => void;
  onDelete?: () => void;
  onMembros?: () => void;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Folder className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">{title}</h2>
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
              {series.length}
            </Badge>
          </div>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {pasta && (onRename || onDelete || onMembros) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onMembros && (
                <DropdownMenuItem onClick={onMembros}>
                  <Users className="mr-2 h-4 w-4" />
                  Participantes
                </DropdownMenuItem>
              )}
              {onRename && (
                <DropdownMenuItem onClick={onRename}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Renomear
                </DropdownMenuItem>
              )}
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={onDelete}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir pasta
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {series.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
          Nenhuma série nesta pasta.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {series.map((serie) => (
            <SerieCard
              key={serie.id}
              tarefa={serie}
              pastas={pastas}
              onOpen={() => onOpenSerie(serie.id)}
              canMove
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function RecorrentesPastasBoard({
  series,
  isLoading,
  onOpenSerie,
}: {
  series: TarefaWithRelations[];
  isLoading: boolean;
  onOpenSerie: (id: string) => void;
}) {
  const { data: profile } = useProfile();
  const { data: pessoas } = usePessoas();
  const { data: pastas = [], isLoading: loadingPastas } = useRecorrenciaPastas();
  const createPasta = useCreateRecorrenciaPasta();
  const renamePasta = useRenameRecorrenciaPasta();
  const deletePasta = useDeleteRecorrenciaPasta();
  const setMembros = useSetRecorrenciaPastaMembros();

  const [novaPastaOpen, setNovaPastaOpen] = useState(false);
  const [novaPastaNome, setNovaPastaNome] = useState("");
  const [renameTarget, setRenameTarget] = useState<RecorrenciaPasta | null>(null);
  const [renameNome, setRenameNome] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<RecorrenciaPasta | null>(null);
  const [membrosTarget, setMembrosTarget] = useState<RecorrenciaPasta | null>(null);
  const [membroIds, setMembroIds] = useState<string[]>([]);

  const seriesTyped = series as SerieComPasta[];

  const pastasVisiveis = useMemo(
    () => pastas.filter((p) => canSeeRecorrenciaPasta(profile, p)),
    [pastas, profile],
  );

  const entradas = useMemo(
    () => seriesTyped.filter((s) => !s.recorrencia_pasta_id),
    [seriesTyped],
  );

  const seriesPorPasta = useMemo(() => {
    const map = new Map<string, SerieComPasta[]>();
    for (const pasta of pastasVisiveis) map.set(pasta.id, []);
    for (const serie of seriesTyped) {
      const pid = serie.recorrencia_pasta_id;
      if (!pid) continue;
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid)!.push(serie);
    }
    return map;
  }, [seriesTyped, pastasVisiveis]);

  if (isLoading || loadingPastas) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        {canCreateRecorrenciaPasta(profile) && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setNovaPastaNome("");
              setNovaPastaOpen(true);
            }}
          >
            <FolderPlus className="h-4 w-4" />
            Nova pasta
          </Button>
        )}
      </div>

      <PastaSection
        title="Entradas"
        subtitle="Séries sem pasta"
        series={entradas}
        pastas={pastasVisiveis}
        onOpenSerie={onOpenSerie}
      />

      {pastasVisiveis.map((pasta) => {
        const subtitle = [
          pasta.criador?.nome_completo,
          pasta.created_at
            ? format(new Date(pasta.created_at), "dd MMM yyyy", { locale: ptBR })
            : null,
        ]
          .filter(Boolean)
          .join(" · ");

        return (
          <PastaSection
            key={pasta.id}
            title={pasta.nome}
            subtitle={subtitle}
            series={seriesPorPasta.get(pasta.id) ?? []}
            pastas={pastasVisiveis}
            onOpenSerie={onOpenSerie}
            pasta={pasta}
            onMembros={
              canManageRecorrenciaPastaMembros(profile, pasta)
                ? () => {
                    setMembrosTarget(pasta);
                    setMembroIds((pasta.membros ?? []).map((m) => m.usuario_id));
                  }
                : undefined
            }
            onRename={
              canDeleteRecorrenciaPasta(profile, pasta)
                ? () => {
                    setRenameTarget(pasta);
                    setRenameNome(pasta.nome);
                  }
                : undefined
            }
            onDelete={
              canDeleteRecorrenciaPasta(profile, pasta)
                ? () => setDeleteTarget(pasta)
                : undefined
            }
          />
        );
      })}

      <Dialog open={novaPastaOpen} onOpenChange={setNovaPastaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova pasta</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="pasta-nome">Nome</Label>
            <Input
              id="pasta-nome"
              value={novaPastaNome}
              onChange={(e) => setNovaPastaNome(e.target.value)}
              placeholder="Ex.: Financeiro, Rotinas da equipe…"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNovaPastaOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={createPasta.isPending}
              onClick={() =>
                void createPasta
                  .mutateAsync(novaPastaNome)
                  .then(() => {
                    toast.success("Pasta criada");
                    setNovaPastaOpen(false);
                  })
                  .catch((e) =>
                    toast.error("Erro ao criar pasta", {
                      description: getSupabaseErrorMessage(e as Error),
                    }),
                  )
              }
            >
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!renameTarget}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear pasta</DialogTitle>
          </DialogHeader>
          <Input value={renameNome} onChange={(e) => setRenameNome(e.target.value)} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenameTarget(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={renamePasta.isPending || !renameTarget}
              onClick={() => {
                if (!renameTarget) return;
                void renamePasta
                  .mutateAsync({ id: renameTarget.id, nome: renameNome })
                  .then(() => {
                    toast.success("Pasta renomeada");
                    setRenameTarget(null);
                  })
                  .catch((e) =>
                    toast.error("Erro ao renomear", {
                      description: getSupabaseErrorMessage(e as Error),
                    }),
                  );
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!membrosTarget}
        onOpenChange={(open) => {
          if (!open) setMembrosTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Participantes — {membrosTarget?.nome}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Participar da pasta organiza as séries, mas não libera o acesso ao modelo. Cada série
            mantém seus próprios responsáveis e visualizadores.
          </p>
          <PessoasMultiSelect
            pessoas={(pessoas ?? []).filter((p) => p.ativo)}
            value={membroIds}
            onChange={setMembroIds}
            placeholder="Adicionar pessoas"
            emptyLabel="Nenhuma pessoa"
            searchPlaceholder="Buscar…"
            inline
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMembrosTarget(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={setMembros.isPending || !membrosTarget}
              onClick={() => {
                if (!membrosTarget) return;
                void setMembros
                  .mutateAsync({ pastaId: membrosTarget.id, usuarioIds: membroIds })
                  .then(() => {
                    toast.success("Participantes atualizados");
                    setMembrosTarget(null);
                  })
                  .catch((e) =>
                    toast.error("Erro ao salvar participantes", {
                      description: getSupabaseErrorMessage(e as Error),
                    }),
                  );
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        itemKind="pasta"
        itemName={deleteTarget?.nome}
        description="As séries desta pasta voltam para Entradas. Nenhuma série será excluída."
        loading={deletePasta.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await deletePasta.mutateAsync(deleteTarget.id);
            toast.success("Pasta excluída");
            setDeleteTarget(null);
          } catch (e) {
            toast.error("Erro ao excluir pasta", {
              description: getSupabaseErrorMessage(e as Error),
            });
            throw e;
          }
        }}
      />
    </div>
  );
}
