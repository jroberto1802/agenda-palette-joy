import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { Check } from "lucide-react";
import { useState, type MouseEvent } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Acima de Dialog/Sheet (z-50) e do drawer de subtarefa (z-[70]). */
const OVERLAY_Z = "z-[110]";

/**
 * Bolinha de seleção usada em tarefas e subtarefas para alternar entre
 * Aberta/Concluída. Ao marcar como concluída, exibe confirmação antes de
 * efetivar. Ao reabrir (desmarcar), aplica direto — ação de baixo risco.
 */
export function ConclusaoBolinha({
  concluida,
  kind,
  disabled = false,
  size = "default",
  onToggle,
  className,
}: {
  concluida: boolean;
  /** Usado no texto de confirmação: "Deseja concluir essa {kind}?" */
  kind: "tarefa" | "subtarefa";
  disabled?: boolean;
  size?: "default" | "sm";
  /** Deve lançar (throw) em caso de erro para manter o diálogo aberto. */
  onToggle: (concluida: boolean) => void | Promise<void>;
  className?: string;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const handleClick = (event: MouseEvent) => {
    event.stopPropagation();
    if (disabled || pending) return;
    if (concluida) {
      void onToggle(false);
      return;
    }
    setConfirmOpen(true);
  };

  const handleConfirm = async (event: MouseEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      await onToggle(true);
      setConfirmOpen(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label={concluida ? `Reabrir ${kind}` : `Concluir ${kind}`}
        title={concluida ? `Reabrir ${kind}` : `Concluir ${kind}`}
        disabled={disabled}
        onClick={handleClick}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          size === "sm" ? "h-5 w-5" : "h-6 w-6",
          concluida
            ? "border-green-500 bg-green-500 text-white"
            : "border-muted-foreground/40 text-transparent hover:border-primary",
          disabled && "cursor-not-allowed opacity-60",
          className,
        )}
      >
        <Check className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} strokeWidth={3} />
      </button>

      <AlertDialogPrimitive.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogPrimitive.Portal>
          <AlertDialogPrimitive.Overlay
            className={cn(
              "fixed inset-0 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              OVERLAY_Z,
            )}
          />
          <AlertDialogPrimitive.Content
            className={cn(
              "fixed left-[50%] top-[50%] grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg",
              OVERLAY_Z,
            )}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-col space-y-2 text-center sm:text-left">
              <AlertDialogPrimitive.Title className="text-lg font-semibold">
                Concluir {kind}?
              </AlertDialogPrimitive.Title>
              <AlertDialogPrimitive.Description className="text-sm text-muted-foreground">
                Deseja concluir essa {kind}?
              </AlertDialogPrimitive.Description>
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
              <AlertDialogPrimitive.Cancel
                disabled={pending}
                className={cn(buttonVariants({ variant: "outline" }), "mt-2 sm:mt-0")}
              >
                Cancelar
              </AlertDialogPrimitive.Cancel>
              <AlertDialogPrimitive.Action
                disabled={pending}
                onClick={(event) => void handleConfirm(event)}
                className={cn(buttonVariants())}
              >
                {pending ? "Concluindo..." : "Concluir"}
              </AlertDialogPrimitive.Action>
            </div>
          </AlertDialogPrimitive.Content>
        </AlertDialogPrimitive.Portal>
      </AlertDialogPrimitive.Root>
    </>
  );
}
