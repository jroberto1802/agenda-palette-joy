import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { useState, type MouseEvent } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import type { EscopoExclusaoSerie } from "@/services/tarefa-recorrencia";

const OVERLAY_Z = "z-[110]";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName?: string | null;
  /** Se true, oferece opções de série; senão exclusão simples. */
  isSerie: boolean;
  onConfirm: (escopo: EscopoExclusaoSerie) => void | Promise<void>;
  loading?: boolean;
};

/**
 * Confirmação de exclusão com opções para série recorrente.
 */
export function ConfirmSerieDeleteDialog({
  open,
  onOpenChange,
  itemName,
  isSerie,
  onConfirm,
  loading = false,
}: Props) {
  const [escopo, setEscopo] = useState<EscopoExclusaoSerie>("somente_esta");
  const [pending, setPending] = useState(false);
  const isBusy = loading || pending;

  const handleConfirm = async (event: MouseEvent) => {
    event.preventDefault();
    if (isBusy) return;
    setPending(true);
    try {
      await onConfirm(isSerie ? escopo : "somente_esta");
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  };

  const quoted = itemName?.trim() ? ` "${itemName.trim()}"` : "";

  return (
    <AlertDialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) setEscopo("somente_esta");
        onOpenChange(next);
      }}
    >
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            OVERLAY_Z,
          )}
        />
        <AlertDialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg",
            OVERLAY_Z,
          )}
        >
          <div className="flex flex-col space-y-2 text-center sm:text-left">
            <AlertDialogPrimitive.Title className="text-lg font-semibold">
              Excluir tarefa{isSerie ? " recorrente" : ""}?
            </AlertDialogPrimitive.Title>
            <AlertDialogPrimitive.Description className="text-sm text-muted-foreground">
              {isSerie
                ? `Escolha o alcance da exclusão da tarefa${quoted}.`
                : `Excluir a tarefa${quoted}? Ela será removida da listagem (exclusão lógica). Esta ação não pode ser desfeita.`}
            </AlertDialogPrimitive.Description>
          </div>

          {isSerie && (
            <RadioGroup
              value={escopo}
              onValueChange={(v) => setEscopo(v as EscopoExclusaoSerie)}
              className="gap-3"
              disabled={isBusy}
            >
              <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 has-[:checked]:border-primary">
                <RadioGroupItem value="somente_esta" id="del-somente-esta" className="mt-0.5" />
                <div className="space-y-1">
                  <Label htmlFor="del-somente-esta" className="cursor-pointer font-medium">
                    Somente esta ocorrência
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Remove apenas esta ocorrência. A recorrência permanece ativa.
                  </p>
                </div>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 has-[:checked]:border-primary">
                <RadioGroupItem value="futuras" id="del-futuras" className="mt-0.5" />
                <div className="space-y-1">
                  <Label htmlFor="del-futuras" className="cursor-pointer font-medium">
                    Excluir apenas ocorrências futuras
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Remove esta e as próximas ocorrências materializadas e interrompe a geração de
                    novas.
                  </p>
                </div>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 has-[:checked]:border-primary">
                <RadioGroupItem value="serie_inteira" id="del-serie" className="mt-0.5" />
                <div className="space-y-1">
                  <Label htmlFor="del-serie" className="cursor-pointer font-medium">
                    Excluir toda a série
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Remove o modelo e todas as ocorrências da série.
                  </p>
                </div>
              </label>
            </RadioGroup>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
            <AlertDialogPrimitive.Cancel
              disabled={isBusy}
              className={cn(buttonVariants({ variant: "outline" }), "mt-2 sm:mt-0")}
            >
              Cancelar
            </AlertDialogPrimitive.Cancel>
            <AlertDialogPrimitive.Action
              disabled={isBusy}
              onClick={(event) => void handleConfirm(event)}
              className={cn(
                buttonVariants(),
                "bg-destructive text-destructive-foreground hover:bg-destructive/90",
              )}
            >
              {isBusy ? "Excluindo..." : "Excluir"}
            </AlertDialogPrimitive.Action>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
