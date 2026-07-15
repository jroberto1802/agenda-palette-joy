import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/common/confirm-delete-dialog";
import { ProfileAvatar } from "@/components/common/profile-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCreateEquipeGrupo,
  useDeleteEquipeGrupo,
  useEquipeGrupos,
  useMovePessoaEquipeGrupo,
  useRenameEquipeGrupo,
} from "@/hooks/use-equipe-grupos";
import { usePessoas } from "@/hooks/use-pessoas";
import { useProfile } from "@/hooks/use-profile";
import { useTarefas } from "@/hooks/use-tarefas";
import { CARD_GRID_CLASS } from "@/lib/layout";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import { cn } from "@/lib/utils";
import { EQUIPE_SEM_GRUPO_ID } from "@/services/equipe-grupos";
import type { ProfileWithSetor, TarefaWithRelations } from "@/types";
import { isAdminOrGerente } from "@/utils/permissions";
import { getTarefaResponsaveis } from "@/utils/tarefas";

export const Route = createFileRoute("/_authenticated/equipe")({
  head: () => ({
    meta: [
      { title: "Equipe — CoreGestor" },
      {
        name: "description",
        content: "Visão da equipe com grupos personalizados e acesso às agendas.",
      },
    ],
  }),
  component: EquipePage,
});

type EquipeSecao = {
  id: string;
  nome: string;
  isOutros: boolean;
  pessoas: ProfileWithSetor[];
};

function countTarefasDaPessoa(
  pessoaId: string,
  tarefas: TarefaWithRelations[] | undefined,
): number {
  let total = 0;
  for (const tarefa of tarefas ?? []) {
    const responsavelIds = getTarefaResponsaveis(tarefa).map((r) => r.id);
    if (responsavelIds.length === 0 && tarefa.atribuido_a) {
      responsavelIds.push(tarefa.atribuido_a);
    }
    if (responsavelIds.includes(pessoaId)) total += 1;
  }
  return total;
}

function PessoaCardContent({
  pessoa,
  totalTarefas,
  showContador,
  interactive,
  isDragging,
}: {
  pessoa: ProfileWithSetor;
  totalTarefas: number;
  showContador: boolean;
  interactive?: boolean;
  isDragging?: boolean;
}) {
  const cargoSetor = [pessoa.cargo, pessoa.setor?.nome].filter(Boolean).join(" · ");

  return (
    <Card
      className={cn(
        "transition-colors",
        interactive && "hover:border-primary/40 hover:bg-muted/30",
        isDragging && "opacity-50 ring-2 ring-primary",
      )}
    >
      <CardContent className="flex items-center gap-3 p-4">
        <ProfileAvatar
          name={pessoa.nome_completo}
          avatarUrl={pessoa.avatar_url}
          className="h-12 w-12 shrink-0"
          fallbackClassName="text-sm"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight">{pessoa.nome_completo}</p>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {cargoSetor || "Sem cargo/setor"}
          </p>
        </div>
        {showContador && (
          <Badge variant="secondary" className="shrink-0">
            {totalTarefas} {totalTarefas === 1 ? "tarefa" : "tarefas"}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

function EquipePessoaCard({
  pessoa,
  totalTarefas,
  showContador,
  canOpenAgenda,
  canDrag,
  grupoId,
}: {
  pessoa: ProfileWithSetor;
  totalTarefas: number;
  showContador: boolean;
  canOpenAgenda: boolean;
  canDrag: boolean;
  grupoId: string;
}) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `pessoa:${pessoa.id}`,
    data: { pessoaId: pessoa.id, fromGrupoId: grupoId },
    disabled: !canDrag,
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  const handleClick = () => {
    if (isDragging || !canOpenAgenda) return;
    navigate({ to: "/equipe/$pessoaId", params: { pessoaId: pessoa.id } });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(canDrag ? { ...listeners, ...attributes } : {})}
      className={cn(
        canOpenAgenda && "cursor-pointer",
        canDrag && "cursor-grab active:cursor-grabbing",
        !canOpenAgenda && !canDrag && "cursor-default",
      )}
      onClick={canOpenAgenda ? handleClick : undefined}
      role={canOpenAgenda ? "button" : undefined}
      tabIndex={canOpenAgenda ? 0 : undefined}
      onKeyDown={
        canOpenAgenda
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleClick();
              }
            }
          : undefined
      }
      aria-label={
        canOpenAgenda ? `Ver agenda de ${pessoa.nome_completo}` : pessoa.nome_completo
      }
    >
      <PessoaCardContent
        pessoa={pessoa}
        totalTarefas={totalTarefas}
        showContador={showContador}
        interactive={canOpenAgenda}
        isDragging={isDragging}
      />
    </div>
  );
}

function EquipeGrupoSection({
  secao,
  canManage,
  showContador,
  canOpenAgenda,
  tarefas,
  onRename,
  onDelete,
}: {
  secao: EquipeSecao;
  canManage: boolean;
  showContador: boolean;
  canOpenAgenda: boolean;
  tarefas: TarefaWithRelations[] | undefined;
  onRename: (id: string, nome: string) => void;
  onDelete: (id: string, nome: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `grupo:${secao.id}`,
    data: { grupoId: secao.id },
    disabled: !canManage,
  });

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-foreground/90">
          {secao.nome}
        </h2>
        {canManage && !secao.isOutros && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground"
                aria-label={`Opções do grupo ${secao.nome}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onRename(secao.id, secao.nome)}>
                <Pencil className="mr-2 h-4 w-4" />
                Renomear
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(secao.id, secao.nome)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir grupo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "min-h-[5.5rem] rounded-xl transition-colors",
          canManage && "border border-transparent p-1",
          canManage && isOver && "border-primary bg-primary/5",
          canManage && !secao.pessoas.length && "border-dashed border-muted-foreground/25",
        )}
      >
        {secao.pessoas.length ? (
          <div className={CARD_GRID_CLASS}>
            {secao.pessoas.map((pessoa) => (
              <EquipePessoaCard
                key={pessoa.id}
                pessoa={pessoa}
                totalTarefas={countTarefasDaPessoa(pessoa.id, tarefas)}
                showContador={showContador}
                canOpenAgenda={canOpenAgenda}
                canDrag={canManage}
                grupoId={secao.id}
              />
            ))}
          </div>
        ) : canManage ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            Arraste pessoas para este grupo
          </p>
        ) : null}
      </div>
    </section>
  );
}

function EquipePage() {
  const { data: profile, isLoading: loadingProfile } = useProfile();
  const { data: pessoas, isLoading: loadingPessoas } = usePessoas();
  const { data: grupos, isLoading: loadingGrupos } = useEquipeGrupos();
  const canManage = isAdminOrGerente(profile);
  // Contador e agenda de terceiros: só Admin/Gestor — não buscar tarefas para colaborador.
  const { data: tarefas, isLoading: loadingTarefas } = useTarefas(
    {},
    { enabled: !loadingProfile && canManage },
  );

  const createGrupo = useCreateEquipeGrupo();
  const renameGrupo = useRenameEquipeGrupo();
  const deleteGrupo = useDeleteEquipeGrupo();
  const movePessoa = useMovePessoaEquipeGrupo();

  const [createOpen, setCreateOpen] = useState(false);
  const [createNome, setCreateNome] = useState("");
  const [renameTarget, setRenameTarget] = useState<{ id: string; nome: string } | null>(null);
  const [renameNome, setRenameNome] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nome: string } | null>(null);
  const [activePessoa, setActivePessoa] = useState<ProfileWithSetor | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const pessoasAtivas = useMemo(
    () => (pessoas ?? []).filter((pessoa) => pessoa.ativo),
    [pessoas],
  );

  const secoes = useMemo((): EquipeSecao[] => {
    const pessoaPorId = new Map(pessoasAtivas.map((p) => [p.id, p]));
    const atribuido = new Set<string>();
    const result: EquipeSecao[] = [];

    for (const grupo of grupos ?? []) {
      const membros = (grupo.membros ?? [])
        .map((m) => pessoaPorId.get(m.usuario_id))
        .filter((p): p is ProfileWithSetor => !!p)
        .sort((a, b) => a.nome_completo.localeCompare(b.nome_completo, "pt-BR"));

      for (const membro of membros) atribuido.add(membro.id);

      result.push({
        id: grupo.id,
        nome: grupo.nome,
        isOutros: false,
        pessoas: membros,
      });
    }

    const semGrupo = pessoasAtivas
      .filter((p) => !atribuido.has(p.id))
      .sort((a, b) => a.nome_completo.localeCompare(b.nome_completo, "pt-BR"));

    if (canManage || semGrupo.length > 0) {
      result.push({
        id: EQUIPE_SEM_GRUPO_ID,
        nome: "Outros",
        isOutros: true,
        pessoas: semGrupo,
      });
    }

    return result;
  }, [grupos, pessoasAtivas, canManage]);

  const handleDragStart = (event: DragStartEvent) => {
    const pessoaId = String(event.active.data.current?.pessoaId ?? "");
    setActivePessoa(pessoasAtivas.find((p) => p.id === pessoaId) ?? null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActivePessoa(null);
    if (!canManage) return;

    const { active, over } = event;
    if (!over) return;

    const pessoaId = String(active.data.current?.pessoaId ?? "");
    const fromGrupoId = String(active.data.current?.fromGrupoId ?? "");
    const overId = String(over.id);

    if (!pessoaId || !overId.startsWith("grupo:")) return;

    const toGrupoId = overId.slice("grupo:".length);
    if (!toGrupoId || toGrupoId === fromGrupoId) return;

    try {
      await movePessoa.mutateAsync({
        usuarioId: pessoaId,
        grupoId: toGrupoId === EQUIPE_SEM_GRUPO_ID ? null : toGrupoId,
      });
    } catch (error) {
      toast.error("Não foi possível mover a pessoa", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  const handleCreate = async () => {
    try {
      await createGrupo.mutateAsync(createNome);
      toast.success("Grupo criado");
      setCreateOpen(false);
      setCreateNome("");
    } catch (error) {
      toast.error("Erro ao criar grupo", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    try {
      await renameGrupo.mutateAsync({ id: renameTarget.id, nome: renameNome });
      toast.success("Grupo renomeado");
      setRenameTarget(null);
      setRenameNome("");
    } catch (error) {
      toast.error("Erro ao renomear grupo", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteGrupo.mutateAsync(deleteTarget.id);
      toast.success("Grupo excluído");
      setDeleteTarget(null);
    } catch (error) {
      toast.error("Erro ao excluir grupo", {
        description: getSupabaseErrorMessage(error as Error),
      });
      throw error;
    }
  };

  const loading =
    loadingProfile ||
    loadingPessoas ||
    loadingGrupos ||
    (canManage && loadingTarefas);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Equipe</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {canManage
              ? "Organize colaboradores em grupos e arraste os cards entre seções. Clique no card para abrir a agenda."
              : "Visualize os grupos e pessoas da equipe. Contador de tarefas e agenda detalhada ficam restritos a Administrador e Gestor."}
          </p>
        </div>
        {canManage && (
          <Button
            type="button"
            className="shrink-0 gap-2"
            onClick={() => {
              setCreateNome("");
              setCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Novo grupo
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-8">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="space-y-4">
              <Skeleton className="h-6 w-40" />
              <div className={CARD_GRID_CLASS}>
                {Array.from({ length: 3 }).map((__, cardIndex) => (
                  <Skeleton key={cardIndex} className="h-20 rounded-xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : !pessoasAtivas.length ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          Nenhuma pessoa encontrada.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="space-y-8">
            {secoes.map((secao) => (
              <EquipeGrupoSection
                key={secao.id}
                secao={secao}
                canManage={canManage}
                showContador={canManage}
                canOpenAgenda={canManage}
                tarefas={tarefas}
                onRename={(id, nome) => {
                  setRenameTarget({ id, nome });
                  setRenameNome(nome);
                }}
                onDelete={(id, nome) => setDeleteTarget({ id, nome })}
              />
            ))}
          </div>
          <DragOverlay>
            {activePessoa ? (
              <PessoaCardContent
                pessoa={activePessoa}
                totalTarefas={countTarefasDaPessoa(activePessoa.id, tarefas)}
                showContador={canManage}
                interactive
                isDragging
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo grupo</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Nome do grupo"
            value={createNome}
            onChange={(event) => setCreateNome(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && createNome.trim()) {
                event.preventDefault();
                void handleCreate();
              }
            }}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!createNome.trim() || createGrupo.isPending}
              onClick={() => void handleCreate()}
            >
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!renameTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRenameTarget(null);
            setRenameNome("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear grupo</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Nome do grupo"
            value={renameNome}
            onChange={(event) => setRenameNome(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && renameNome.trim()) {
                event.preventDefault();
                void handleRename();
              }
            }}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRenameTarget(null);
                setRenameNome("");
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!renameNome.trim() || renameGrupo.isPending}
              onClick={() => void handleRename()}
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
        itemKind="grupo"
        itemName={deleteTarget?.nome}
        description={
          deleteTarget
            ? `Excluir o grupo "${deleteTarget.nome}"? As pessoas voltam para a seção Outros. O setor de cada pessoa não é alterado. Esta ação não pode ser desfeita.`
            : undefined
        }
        onConfirm={handleDelete}
      />
    </div>
  );
}
