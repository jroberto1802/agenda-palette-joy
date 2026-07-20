import { useEffect, useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMoveSubtarefa, useTarefas } from "@/hooks/use-tarefas";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import { cn } from "@/lib/utils";
import type { SubtarefaWithAuthors } from "@/types";

export function MoverSubtarefaDialog({
  subtarefa,
  open,
  onOpenChange,
}: {
  subtarefa: SubtarefaWithAuthors | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const moveSubtarefa = useMoveSubtarefa();
  const { data: tarefas, isLoading } = useTarefas(
    { excluir_finalizadas: true },
    { enabled: open },
  );
  const [search, setSearch] = useState("");
  const [destinoId, setDestinoId] = useState<string>("");

  useEffect(() => {
    if (!open || !subtarefa) return;
    setSearch("");
    setDestinoId("");
  }, [open, subtarefa]);

  const opcoes = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (tarefas ?? [])
      .filter((t) => t.id !== subtarefa?.tarefa_id)
      .filter((t) => !term || t.titulo.toLowerCase().includes(term))
      .slice(0, 50);
  }, [tarefas, search, subtarefa?.tarefa_id]);

  const handleSave = async () => {
    if (!subtarefa || !destinoId) {
      toast.error("Selecione a tarefa de destino");
      return;
    }
    try {
      await moveSubtarefa.mutateAsync({ id: subtarefa.id, tarefaId: destinoId });
      toast.success("Subtarefa movida");
      onOpenChange(false);
    } catch (error) {
      toast.error("Erro ao mover subtarefa", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mover subtarefa</DialogTitle>
          <DialogDescription>
            Escolha a tarefa de destino. Anexos e comentários são preservados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="truncate text-sm font-medium">{subtarefa?.titulo}</p>

          <div className="space-y-2">
            <Label htmlFor="mover-subtarefa-busca">Tarefa de destino</Label>
            <Input
              id="mover-subtarefa-busca"
              placeholder="Buscar tarefa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <ScrollArea className="h-56 rounded-md border">
            <div className="p-1">
              {isLoading ? (
                <p className="p-3 text-sm text-muted-foreground">Carregando tarefas...</p>
              ) : !opcoes.length ? (
                <p className="p-3 text-sm text-muted-foreground">Nenhuma tarefa encontrada.</p>
              ) : (
                opcoes.map((tarefa) => (
                  <button
                    key={tarefa.id}
                    type="button"
                    onClick={() => setDestinoId(tarefa.id)}
                    className={cn(
                      "flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                      destinoId === tarefa.id && "bg-muted",
                    )}
                  >
                    <span className="truncate font-medium">{tarefa.titulo}</span>
                    {(tarefa.projeto?.nome || tarefa.setor?.nome) && (
                      <span className="truncate text-xs text-muted-foreground">
                        {[tarefa.projeto?.nome, tarefa.setor?.nome].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={!destinoId || moveSubtarefa.isPending}
          >
            {moveSubtarefa.isPending ? "Movendo..." : "Mover"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
