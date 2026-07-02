import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { SetorCard } from "@/components/setores/setor-card";
import { SetorFormDialog } from "@/components/setores/setor-form-dialog";
import { usePessoas } from "@/hooks/use-pessoas";
import { useProfile } from "@/hooks/use-profile";
import {
  useCreateSetor,
  useDeleteSetor,
  useSetores,
  useUpdateSetor,
} from "@/hooks/use-setores";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import type { SetorWithGerente } from "@/types";
import { canManageSetores, isAdmin, isAdminOrGerente } from "@/utils/permissions";

export const Route = createFileRoute("/_authenticated/setores")({
  component: SetoresPage,
});

function SetoresPage() {
  const { data: profile } = useProfile();
  const { data: setores, isLoading } = useSetores();
  const { data: pessoas } = usePessoas();
  const createSetor = useCreateSetor();
  const updateSetor = useUpdateSetor();
  const deleteSetor = useDeleteSetor();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SetorWithGerente | null>(null);
  const [deleting, setDeleting] = useState<SetorWithGerente | null>(null);

  const canCreate = canManageSetores(profile);
  const canEdit = isAdminOrGerente(profile);
  const canDelete = isAdmin(profile);

  const gerentes = useMemo(
    () =>
      (pessoas ?? [])
        .filter((p) => p.ativo && (p.papel === "gerente" || p.papel === "admin"))
        .map((p) => ({ id: p.id, nome_completo: p.nome_completo })),
    [pessoas],
  );

  const pessoasPorSetor = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of pessoas ?? []) {
      if (p.setor_id && p.ativo) {
        map.set(p.setor_id, (map.get(p.setor_id) ?? 0) + 1);
      }
    }
    return map;
  }, [pessoas]);

  const handleSave = async (data: Parameters<typeof createSetor.mutateAsync>[0]) => {
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Setores</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Organize a equipe por áreas da empresa.
          </p>
        </div>
        {canCreate && (
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : !setores?.length ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <p className="text-muted-foreground">Nenhum setor cadastrado ainda.</p>
          {canCreate && (
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {setores.map((setor) => (
            <SetorCard
              key={setor.id}
              setor={setor}
              pessoasCount={pessoasPorSetor.get(setor.id) ?? 0}
              canEdit={canEdit}
              canDelete={canDelete}
              onEdit={() => {
                setEditing(setor);
                setDialogOpen(true);
              }}
              onDelete={() => setDeleting(setor)}
            />
          ))}
        </div>
      )}

      <SetorFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        setor={editing}
        gerentes={gerentes}
        onSubmit={handleSave}
        loading={createSetor.isPending || updateSetor.isPending}
      />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir setor?</AlertDialogTitle>
            <AlertDialogDescription>
              O setor &quot;{deleting?.nome}&quot; será removido permanentemente. Pessoas vinculadas
              ficarão sem setor.
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
