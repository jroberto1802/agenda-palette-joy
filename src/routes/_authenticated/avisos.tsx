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
import { AvisoCard, AvisoEmptyState } from "@/components/avisos/aviso-card";
import { AvisoDetailSheet } from "@/components/avisos/aviso-detail-sheet";
import { AvisoFormDialog } from "@/components/avisos/aviso-form-dialog";
import { useAvisos, useCreateAviso, useDeleteAviso } from "@/hooks/use-avisos";
import { usePessoas } from "@/hooks/use-pessoas";
import { useProfile } from "@/hooks/use-profile";
import { useSetores } from "@/hooks/use-setores";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import { isAvisoLido } from "@/services/avisos";
import type { AvisoWithRelations } from "@/types";
import { isAdmin } from "@/utils/permissions";

export const Route = createFileRoute("/_authenticated/avisos")({
  component: AvisosPage,
});

function AvisosPage() {
  const { data: profile } = useProfile();
  const { data: avisos, isLoading } = useAvisos();
  const { data: setores } = useSetores();
  const { data: pessoas } = usePessoas();
  const createAviso = useCreateAviso();
  const deleteAviso = useDeleteAviso();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AvisoWithRelations | null>(null);

  const canCreate = !!profile;
  const pessoasAtivas = useMemo(() => (pessoas ?? []).filter((p) => p.ativo), [pessoas]);

  const naoLidos = useMemo(
    () => (avisos ?? []).filter((a) => !isAvisoLido(a, profile?.id)).length,
    [avisos, profile?.id],
  );

  const handleCreate = async (data: Parameters<typeof createAviso.mutateAsync>[0]) => {
    try {
      await createAviso.mutateAsync(data);
      toast.success("Aviso publicado");
      setDialogOpen(false);
    } catch (error) {
      toast.error("Erro ao publicar aviso", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteAviso.mutateAsync(deleting.id);
      toast.success("Aviso excluído");
      setDeleting(null);
      if (detailId === deleting.id) setDetailId(null);
    } catch (error) {
      toast.error("Erro ao excluir", { description: getSupabaseErrorMessage(error as Error) });
    }
  };

  const canDeleteAviso = (aviso: AvisoWithRelations) =>
    isAdmin(profile) || aviso.criado_por === profile?.id;

  const selectedAviso = avisos?.find((a) => a.id === detailId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quadro de Avisos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Comunicados internos da empresa
            {naoLidos > 0 && (
              <span className="text-primary font-medium"> · {naoLidos} não lido(s)</span>
            )}
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setDialogOpen(true)} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            Novo aviso
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : !avisos?.length ? (
        <AvisoEmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {avisos.map((aviso) => (
            <AvisoCard
              key={aviso.id}
              aviso={aviso}
              lido={isAvisoLido(aviso, profile?.id)}
              onOpen={() => setDetailId(aviso.id)}
            />
          ))}
        </div>
      )}

      <AvisoFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        setores={setores ?? []}
        pessoas={pessoasAtivas}
        onSubmit={handleCreate}
        loading={createAviso.isPending}
      />

      <AvisoDetailSheet
        avisoId={detailId}
        open={!!detailId}
        onOpenChange={(open) => !open && setDetailId(null)}
        canDelete={selectedAviso ? canDeleteAviso(selectedAviso) : false}
        onDelete={() => {
          const aviso = avisos?.find((a) => a.id === detailId);
          if (aviso) setDeleting(aviso);
        }}
      />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir aviso?</AlertDialogTitle>
            <AlertDialogDescription>
              O aviso &quot;{deleting?.titulo}&quot; será removido permanentemente.
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
