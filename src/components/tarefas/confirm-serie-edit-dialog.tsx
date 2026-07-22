import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { useState, type MouseEvent } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import type { EscopoEdicaoSerie } from "@/services/tarefa-recorrencia";

const OVERLAY_Z = "z-[110]";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (escopo: EscopoEdicaoSerie) => void | Promise<void>;
  loading?: boolean;
};

/**
 * Confirmação ao editar ocorrência de série recorrente.
 */
export function ConfirmSerieEditDialog({
  open,
  onOpenChange,
  onConfirm,
  loading = false,
}: Props) {
  const [escopo, setEscopo] = useState<EscopoEdicaoSerie>("somente_esta");
  const [pending, setPending] = useState(false);
  const isBusy = loading || pending;

  const handleConfirm = async (event: MouseEvent) => {
    event.preventDefault();
    if (isBusy) return;
    setPending(true);
    try {
      await onConfirm(escopo);
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  };

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
              Onde deseja aplicar esta alteração?
            </AlertDialogPrimitive.Title>
            <AlertDialogPrimitive.Description className="text-sm text-muted-foreground">
              Escolha o alcance da edição nesta série recorrente.
            </AlertDialogPrimitive.Description>
          </div>

          <RadioGroup
            value={escopo}
            onValueChange={(v) => setEscopo(v as EscopoEdicaoSerie)}
            className="gap-3"
            disabled={isBusy}
          >
            <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 has-[:checked]:border-primary">
              <RadioGroupItem value="somente_esta" id="escopo-somente-esta" className="mt-0.5" />
              <div className="space-y-1">
                <Label htmlFor="escopo-somente-esta" className="cursor-pointer font-medium">
                  Somente esta ocorrência
                </Label>
                <p className="text-xs text-muted-foreground">
                  A alteração vale apenas para a ocorrência aberta. O Modelo permanece igual.
                </p>
              </div>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 has-[:checked]:border-primary">
              <RadioGroupItem value="esta_e_futuras" id="escopo-esta-futuras" className="mt-0.5" />
              <div className="space-y-1">
                <Label htmlFor="escopo-esta-futuras" className="cursor-pointer font-medium">
                  Esta ocorrência e as futuras
                </Label>
                <p className="text-xs text-muted-foreground">
                  Atualiza a ocorrência atual e o Modelo da série. Ocorrências passadas, atrasadas
                  ou finalizadas não são alteradas.
                </p>
              </div>
            </label>
          </RadioGroup>

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
              className={buttonVariants()}
            >
              {isBusy ? "Salvando..." : "Aplicar"}
            </AlertDialogPrimitive.Action>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
