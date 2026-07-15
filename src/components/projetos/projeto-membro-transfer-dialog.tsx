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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRemoveProjetoMembroComTransferencia } from "@/hooks/use-projetos";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import type { ProjetoAtividadeTransferivel } from "@/services/projetos";
import type { ProfileWithSetor, ProjetoMembro } from "@/types";

export function ProjetoMembroTransferDialog({
  open,
  onOpenChange,
  projetoId,
  membro,
  atividades,
  candidatos,
  onTransferred,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projetoId: string;
  membro: ProjetoMembro | null;
  atividades: ProjetoAtividadeTransferivel[];
  candidatos: ProfileWithSetor[];
  onTransferred?: () => void;
}) {
  const removeComTransfer = useRemoveProjetoMembroComTransferencia();
  const [mode, setMode] = useState<"bulk" | "individual">("bulk");
  const [bulkId, setBulkId] = useState("");
  const [individual, setIndividual] = useState<Record<string, string>>({});

  const disponiveis = useMemo(
    () => candidatos.filter((p) => p.ativo && p.id !== membro?.id),
    [candidatos, membro?.id],
  );

  useEffect(() => {
    if (!open) return;
    setMode("bulk");
    setBulkId("");
    const initial: Record<string, string> = {};
    for (const a of atividades) {
      initial[`${a.kind}:${a.id}`] = "";
    }
    setIndividual(initial);
  }, [open, atividades]);

  const canSubmit =
    mode === "bulk"
      ? !!bulkId
      : atividades.every((a) => !!individual[`${a.kind}:${a.id}`]);

  const handleConfirm = async () => {
    if (!membro) return;
    try {
      if (mode === "bulk") {
        await removeComTransfer.mutateAsync({
          projetoId,
          usuarioId: membro.id,
          transfer: { mode: "bulk", novoResponsavelId: bulkId },
        });
      } else {
        await removeComTransfer.mutateAsync({
          projetoId,
          usuarioId: membro.id,
          transfer: {
            mode: "individual",
            assignments: atividades.map((a) => ({
              kind: a.kind,
              id: a.id,
              novoResponsavelId: individual[`${a.kind}:${a.id}`],
            })),
          },
        });
      }
      toast.success("Pessoa removida e responsabilidades transferidas");
      onOpenChange(false);
      onTransferred?.();
    } catch (error) {
      toast.error("Erro ao transferir responsabilidades", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Transferir responsabilidades</DialogTitle>
          <DialogDescription>
            {membro
              ? `${membro.nome_completo} possui ${atividades.length} ${
                  atividades.length === 1 ? "atividade" : "atividades"
                } neste projeto. Defina o novo responsável antes de remover.`
              : "Defina o novo responsável antes de remover."}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={mode}
          onValueChange={(value) => setMode(value as "bulk" | "individual")}
          className="space-y-4"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="bulk">Transferir todas</TabsTrigger>
            <TabsTrigger value="individual">Uma a uma</TabsTrigger>
          </TabsList>

          <TabsContent value="bulk" className="space-y-3">
            <div className="space-y-2">
              <Label>Novo responsável para todas as atividades</Label>
              {disponiveis.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Não há outros membros no projeto para receber as responsabilidades.
                  Adicione alguém à equipe antes de remover esta pessoa.
                </p>
              ) : (
                <Select value={bulkId || undefined} onValueChange={setBulkId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um membro do projeto" />
                  </SelectTrigger>
                  <SelectContent>
                    {disponiveis.map((pessoa) => (
                      <SelectItem key={pessoa.id} value={pessoa.id}>
                        {pessoa.nome_completo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2 text-sm text-muted-foreground">
              {atividades.map((a) => (
                <li key={`${a.kind}:${a.id}`}>
                  {a.kind === "tarefa" ? "Tarefa" : "Subtarefa"}: {a.titulo}
                </li>
              ))}
            </ul>
          </TabsContent>

          <TabsContent value="individual" className="space-y-3">
            <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
              {atividades.map((a) => {
                const key = `${a.kind}:${a.id}`;
                return (
                  <div key={key} className="space-y-1.5 rounded-md border p-3">
                    <p className="text-sm font-medium">
                      {a.kind === "tarefa" ? "Tarefa" : "Subtarefa"}: {a.titulo}
                    </p>
                    {disponiveis.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nenhum outro membro disponível neste projeto.
                      </p>
                    ) : (
                      <Select
                        value={individual[key] || undefined}
                        onValueChange={(value) =>
                          setIndividual((prev) => ({ ...prev, [key]: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Membro do projeto" />
                        </SelectTrigger>
                        <SelectContent>
                          {disponiveis.map((pessoa) => (
                            <SelectItem key={pessoa.id} value={pessoa.id}>
                              {pessoa.nome_completo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={removeComTransfer.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!canSubmit || removeComTransfer.isPending || disponiveis.length === 0}
            onClick={() => void handleConfirm()}
          >
            {removeComTransfer.isPending ? "Transferindo..." : "Transferir e remover"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
