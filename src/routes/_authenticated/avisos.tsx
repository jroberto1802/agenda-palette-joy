import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AvisoCard, AvisoEmptyState } from "@/components/avisos/aviso-card";
import { AvisoDetailSheet } from "@/components/avisos/aviso-detail-sheet";
import { AvisoFormDialog } from "@/components/avisos/aviso-form-dialog";
import { useAvisos, useCreateAviso, useDeleteAviso } from "@/hooks/use-avisos";
import { usePessoas } from "@/hooks/use-pessoas";
import { useProfile } from "@/hooks/use-profile";
import { useSetores } from "@/hooks/use-setores";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import { CARD_GRID_CLASS } from "@/lib/layout";
import { isAvisoLido } from "@/services/avisos";
import type { AvisoAba, AvisoLeituraFiltro, AvisoWithRelations } from "@/types";
import { isAvisoAtivo, isAvisoFinalizado, matchesAvisoSearch } from "@/utils/avisos";
import { isAdmin, isAdminOrGerente } from "@/utils/permissions";

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
  const [aba, setAba] = useState<AvisoAba>("ativos");
  const [search, setSearch] = useState("");
  const [leituraFiltro, setLeituraFiltro] = useState<AvisoLeituraFiltro>("todos");

  const canCreate = !!profile;
  const pessoasAtivas = useMemo(() => (pessoas ?? []).filter((p) => p.ativo), [pessoas]);

  const avisosFiltrados = useMemo(() => {
    return (avisos ?? []).filter((aviso) => {
      const ativo = isAvisoAtivo(aviso);
      if (aba === "ativos" && !ativo) return false;
      if (aba === "finalizados" && !isAvisoFinalizado(aviso)) return false;
      if (!matchesAvisoSearch(aviso, search)) return false;

      const lido = isAvisoLido(aviso, profile?.id);
      if (leituraFiltro === "lidos" && !lido) return false;
      if (leituraFiltro === "nao_lidos" && lido) return false;

      return true;
    });
  }, [avisos, aba, search, leituraFiltro, profile?.id]);

  const naoLidos = useMemo(
    () =>
      (avisos ?? []).filter((a) => isAvisoAtivo(a) && !isAvisoLido(a, profile?.id)).length,
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

  const canDeleteAviso = (aviso: AvisoWithRelations) => {
    if (isAvisoFinalizado(aviso)) {
      return isAdminOrGerente(profile);
    }
    return isAdmin(profile) || aviso.criado_por === profile?.id;
  };

  const selectedAviso = avisos?.find((a) => a.id === detailId);

  const emptyMessage =
    aba === "ativos"
      ? "Nenhum aviso ativo encontrado."
      : "Nenhum aviso finalizado encontrado.";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quadro de Avisos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Comunicados internos da empresa
            {naoLidos > 0 && (
              <span className="font-medium text-primary"> · {naoLidos} não lido(s)</span>
            )}
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setDialogOpen(true)} className="shrink-0 gap-2">
            <Plus className="h-4 w-4" />
            Novo aviso
          </Button>
        )}
      </div>

      <Tabs value={aba} onValueChange={(value) => setAba(value as AvisoAba)}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <TabsList>
            <TabsTrigger value="ativos">Ativos</TabsTrigger>
            <TabsTrigger value="finalizados">Finalizados</TabsTrigger>
          </TabsList>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por título ou conteúdo..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select
              value={leituraFiltro}
              onValueChange={(value) => setLeituraFiltro(value as AvisoLeituraFiltro)}
            >
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="lidos">Lidos</SelectItem>
                <SelectItem value="nao_lidos">Não lidos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="ativos" className="mt-4">
          {renderGrid()}
        </TabsContent>
        <TabsContent value="finalizados" className="mt-4">
          {renderGrid()}
        </TabsContent>
      </Tabs>

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
        userId={profile?.id}
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

  function renderGrid() {
    if (isLoading) {
      return (
        <div className={CARD_GRID_CLASS}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      );
    }

    if (!avisosFiltrados.length) {
      return <AvisoEmptyState message={emptyMessage} />;
    }

    return (
      <div className={CARD_GRID_CLASS}>
        {avisosFiltrados.map((aviso) => (
          <AvisoCard
            key={aviso.id}
            aviso={aviso}
            lido={isAvisoLido(aviso, profile?.id)}
            onOpen={() => setDetailId(aviso.id)}
          />
        ))}
      </div>
    );
  }
}
