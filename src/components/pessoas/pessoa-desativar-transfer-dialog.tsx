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
import { useDesativarPessoa } from "@/hooks/use-pessoas";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import type { PessoaAtividadeTransferivel } from "@/services/pessoas";
import type { ProfileWithSetor } from "@/types";

export function PessoaDesativarTransferDialog({
  open,
  onOpenChange,
  pessoa,
  atividades,
  candidatos,
  onDesativada,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pessoa: ProfileWithSetor | null;
  atividades: PessoaAtividadeTransferivel[];
  candidatos: ProfileWithSetor[];
  onDesativada?: () => void;
}) {
  const desativar = useDesativarPessoa();
  const [mode, setMode] = useState<"bulk" | "individual">("bulk");
  const [bulkId, setBulkId] = useState("");
  const [individual, setIndividual] = useState<Record<string, string>>({});

  const disponiveis = useMemo(
    () => candidatos.filter((p) => p.ativo && p.id !== pessoa?.id),
    [candidatos, pessoa?.id],
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
    if (!pessoa) return;
    try {
      if (mode === "bulk") {
        await desativar.mutateAsync({
          id: pessoa.id,
          transfer: { mode: "bulk", novoResponsavelId: bulkId },
        });
      } else {
        await desativar.mutateAsync({
          id: pessoa.id,
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
      toast.success("Pessoa desativada e responsabilidades transferidas");
      onOpenChange(false);
      onDesativada?.();
    } catch (error) {
      toast.error("Erro ao desativar pessoa", {
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
            {pessoa
              ? `${pessoa.nome_completo} possui ${atividades.length} ${
                  atividades.length === 1 ? "atividade" : "atividades"
                } sob responsabilidade. Defina o novo responsável antes de desativar.`
              : "Defina o novo responsável antes de desativar."}
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
                  Não há outras pessoas ativas para receber as responsabilidades.
                </p>
              ) : (
                <Select value={bulkId || undefined} onValueChange={setBulkId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma pessoa" />
                  </SelectTrigger>
                  <SelectContent>
                    {disponiveis.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome_completo}
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
                  {a.contexto ? ` (${a.contexto})` : ""}
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
                      {a.contexto ? (
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          · {a.contexto}
                        </span>
                      ) : null}
                    </p>
                    {disponiveis.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nenhuma outra pessoa ativa disponível.
                      </p>
                    ) : (
                      <Select
                        value={individual[key] || undefined}
                        onValueChange={(value) =>
                          setIndividual((prev) => ({ ...prev, [key]: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma pessoa" />
                        </SelectTrigger>
                        <SelectContent>
                          {disponiveis.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nome_completo}
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
            disabled={desativar.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!canSubmit || desativar.isPending || disponiveis.length === 0}
            onClick={() => void handleConfirm()}
          >
            {desativar.isPending ? "Desativando..." : "Transferir e desativar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
