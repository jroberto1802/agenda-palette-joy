import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMoveSerieParaPasta, useRecorrenciaPastas } from "@/hooks/use-recorrencia-pastas";
import { useProfile } from "@/hooks/use-profile";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import { RECORRENCIA_ENTRADAS_SLUG } from "@/services/recorrencia-pastas";
import type { TarefaWithRelations } from "@/types";
import { canSeeRecorrenciaPasta } from "@/utils/permissions";

export function MoverSeriePastaDialog({
  tarefa,
  open,
  onOpenChange,
  pastaAtualId,
}: {
  tarefa: TarefaWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pastaAtualId?: string | null;
}) {
  const { data: profile } = useProfile();
  const { data: pastas = [] } = useRecorrenciaPastas();
  const moveSerie = useMoveSerieParaPasta();
  const atual =
    pastaAtualId ??
    (tarefa as { recorrencia_pasta_id?: string | null } | null)?.recorrencia_pasta_id ??
    null;
  const [destino, setDestino] = useState<string>(atual ?? RECORRENCIA_ENTRADAS_SLUG);

  const pastasVisiveis = useMemo(
    () => pastas.filter((p) => canSeeRecorrenciaPasta(profile, p)),
    [pastas, profile],
  );

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDestino(atual ?? RECORRENCIA_ENTRADAS_SLUG);
    }
    onOpenChange(next);
  };

  const handleConfirm = async () => {
    if (!tarefa) return;
    const pastaId = destino === RECORRENCIA_ENTRADAS_SLUG ? null : destino;
    try {
      await moveSerie.mutateAsync({ tarefaId: tarefa.id, pastaId });
      toast.success(
        pastaId
          ? `Série movida para ${pastasVisiveis.find((p) => p.id === pastaId)?.nome ?? "pasta"}`
          : "Série movida para Entradas",
      );
      onOpenChange(false);
    } catch (error) {
      toast.error("Erro ao mover série", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mover série</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Pasta de destino</Label>
          <Select value={destino} onValueChange={setDestino}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={RECORRENCIA_ENTRADAS_SLUG}>Entradas</SelectItem>
              {pastasVisiveis.map((pasta) => (
                <SelectItem key={pasta.id} value={pasta.id}>
                  {pasta.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={moveSerie.isPending || !tarefa}
            onClick={() => void handleConfirm()}
          >
            Mover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
