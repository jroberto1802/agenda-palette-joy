import { Pencil, Plus, Trash2, Users } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SetorFormDialog } from "@/components/setores/setor-form-dialog";
import { usePessoas } from "@/hooks/use-pessoas";
import {
  useCreateSetor,
  useDeleteSetor,
  useSetores,
  useUpdateSetor,
} from "@/hooks/use-setores";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import type { SetorFormData, SetorWithGerente } from "@/types";

export function CadastroSetoresPanel({ canManage }: { canManage: boolean }) {
  const { data: setores, isLoading } = useSetores();
  const { data: pessoas } = usePessoas();
  const createSetor = useCreateSetor();
  const updateSetor = useUpdateSetor();
  const deleteSetor = useDeleteSetor();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SetorWithGerente | null>(null);
  const [deleting, setDeleting] = useState<SetorWithGerente | null>(null);

  const pessoasPorSetor = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of pessoas ?? []) {
      if (p.setor_id) {
        map.set(p.setor_id, (map.get(p.setor_id) ?? 0) + 1);
      }
    }
    return map;
  }, [pessoas]);

  const handleSave = async (data: SetorFormData) => {
    try {
      if (editing) {
        await updateSetor.mutateAsync({ id: editing.id, data });
        toast.success("Setor atualizado");
      } else {
        await createSetor.mutateAsync(data);
        toast.success("Setor criado");
      }
      setDialogOpen(false);
      setEditing(null);
    } catch (error) {
      toast.error("Erro ao salvar setor", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteSetor.mutateAsync(deleting.id);
      toast.success("Setor excluído");
      setDeleting(null);
    } catch (error) {
      toast.error("Erro ao excluir setor", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  const requestDelete = (setor: SetorWithGerente) => {
    const count = pessoasPorSetor.get(setor.id) ?? 0;
    if (count > 0) {
      toast.error("Não é possível excluir o setor", {
        description:
          "Há pessoas vinculadas a este setor. Realoque as pessoas antes de excluir.",
      });
      return;
    }
    setDeleting(setor);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Setores</h2>
          <p className="text-sm text-muted-foreground">
            Cadastre os setores da empresa (nome e cor).
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
            className="gap-2 shrink-0"
          >
            <Plus className="h-4 w-4" />
            Novo setor
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : !setores?.length ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <p className="text-muted-foreground">Nenhum setor cadastrado ainda.</p>
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
              Criar primeiro setor
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {setores.map((setor) => {
            const pessoasCount = pessoasPorSetor.get(setor.id) ?? 0;
            return (
              <Card key={setor.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: setor.cor ?? "#94a3b8" }}
                      />
                      <CardTitle className="text-base truncate">{setor.nome}</CardTitle>
                    </div>
                    {canManage && (
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditing(setor);
                            setDialogOpen(true);
                          }}
                          aria-label="Editar setor"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => requestDelete(setor)}
                          aria-label="Excluir setor"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {pessoasCount} {pessoasCount === 1 ? "pessoa vinculada" : "pessoas vinculadas"}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {canManage && (
        <SetorFormDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditing(null);
          }}
          setor={editing}
          onSubmit={handleSave}
          loading={createSetor.isPending || updateSetor.isPending}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir setor?</AlertDialogTitle>
            <AlertDialogDescription>
              O setor &quot;{deleting?.nome}&quot; será removido permanentemente.
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
