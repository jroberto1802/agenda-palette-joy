import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useMoveTarefa } from "@/hooks/use-tarefas";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import type { Projeto, SetorWithGerente, TarefaWithRelations } from "@/types";

const NONE = "__none__";

export function MoverTarefaDialog({
  tarefa,
  open,
  onOpenChange,
  setores,
  projetos,
}: {
  tarefa: TarefaWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setores: SetorWithGerente[];
  projetos: Pick<Projeto, "id" | "nome">[];
}) {
  const moveTarefa = useMoveTarefa();
  const [projetoId, setProjetoId] = useState<string>(NONE);
  const [setorId, setSetorId] = useState<string>(NONE);

  useEffect(() => {
    if (!open || !tarefa) return;
    setProjetoId(tarefa.projeto_id ?? NONE);
    setSetorId(tarefa.setor_id ?? NONE);
  }, [open, tarefa]);

  const handleSave = async () => {
    if (!tarefa) return;
    try {
      await moveTarefa.mutateAsync({
        id: tarefa.id,
        projeto_id: projetoId === NONE ? null : projetoId,
        setor_id: setorId === NONE ? null : setorId,
      });
      toast.success("Tarefa movida");
      onOpenChange(false);
    } catch (error) {
      toast.error("Erro ao mover tarefa", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mover tarefa</DialogTitle>
          <DialogDescription>
            Escolha o Projeto e/ou Setor de destino. Subtarefas, anexos e comentários são
            preservados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="truncate text-sm font-medium">{tarefa?.titulo}</p>

          <div className="space-y-2">
            <Label>Projeto</Label>
            <Select value={projetoId} onValueChange={setProjetoId}>
              <SelectTrigger>
                <SelectValue placeholder="Projeto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem projeto</SelectItem>
                {projetos.map((projeto) => (
                  <SelectItem key={projeto.id} value={projeto.id}>
                    {projeto.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Setor</Label>
            <Select value={setorId} onValueChange={setSetorId}>
              <SelectTrigger>
                <SelectValue placeholder="Setor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem setor</SelectItem>
                {setores.map((setor) => (
                  <SelectItem key={setor.id} value={setor.id}>
                    {setor.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={moveTarefa.isPending}>
            {moveTarefa.isPending ? "Movendo..." : "Mover"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
