import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Acima de Dialog/Sheet (z-50) e drawer de subtarefa (z-[70]). */
const OVERLAY_Z = "z-[110]";

const MASCULINE_KINDS = new Set([
  "anexo",
  "comentário",
  "comentario",
  "setor",
  "projeto",
  "aviso",
  "grupo",
]);

function articleFor(itemKind: string): "a" | "o" {
  return MASCULINE_KINDS.has(itemKind.trim().toLowerCase()) ? "o" : "a";
}

/**
 * Monta a descrição padrão de exclusão.
 * Ex.: Excluir a subtarefa "X"? Esta ação não pode ser desfeita.
 */
export function buildDeleteDescription(itemKind: string, itemName?: string | null): string {
  const article = articleFor(itemKind);
  const quoted = itemName?.trim() ? ` "${itemName.trim()}"` : "";
  return `Excluir ${article} ${itemKind}${quoted}? Esta ação não pode ser desfeita.`;
}

/**
 * Pop-up padrão de confirmação para exclusões do sistema.
 * Use este componente em toda ação de excluir (existente ou futura).
 */
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  itemKind,
  itemName,
  title,
  description,
  confirmLabel = "Excluir",
  cancelLabel = "Cancelar",
  loading = false,
  /** Se informado, o usuário deve digitar exatamente este texto para habilitar Excluir. */
  requireTypedConfirmation,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tipo do item no singular, ex.: "tarefa", "subtarefa", "anexo". */
  itemKind: string;
  /** Nome/título identificável do item. */
  itemName?: string | null;
  /** Sobrescreve o título padrão (`Excluir {itemKind}?`). */
  title?: string;
  /** Sobrescreve a descrição padrão. */
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  requireTypedConfirmation?: string;
  onConfirm: () => void | Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [typedConfirm, setTypedConfirm] = useState("");
  const isBusy = loading || pending;
  const typedOk =
    !requireTypedConfirmation || typedConfirm.trim() === requireTypedConfirmation;

  useEffect(() => {
    if (!open) setTypedConfirm("");
  }, [open]);

  const handleConfirm = async (event: MouseEvent) => {
    // Mantém o pop-up aberto até a exclusão concluir (sucesso ou erro).
    event.preventDefault();
    if (isBusy || !typedOk) return;
    setPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
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
              {title ?? `Excluir ${itemKind}?`}
            </AlertDialogPrimitive.Title>
            <AlertDialogPrimitive.Description className="text-sm text-muted-foreground">
              {description ?? buildDeleteDescription(itemKind, itemName)}
            </AlertDialogPrimitive.Description>
          </div>

          {requireTypedConfirmation && (
            <div className="space-y-2 text-left">
              <Label htmlFor="confirm-delete-typed">
                Digite <span className="font-semibold">{requireTypedConfirmation}</span> para
                confirmar
              </Label>
              <Input
                id="confirm-delete-typed"
                value={typedConfirm}
                onChange={(event) => setTypedConfirm(event.target.value)}
                placeholder={requireTypedConfirmation}
                disabled={isBusy}
                autoComplete="off"
              />
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
            <AlertDialogPrimitive.Cancel
              disabled={isBusy}
              className={cn(buttonVariants({ variant: "outline" }), "mt-2 sm:mt-0")}
            >
              {cancelLabel}
            </AlertDialogPrimitive.Cancel>
            <AlertDialogPrimitive.Action
              disabled={isBusy || !typedOk}
              onClick={(event) => void handleConfirm(event)}
              className={cn(
                buttonVariants(),
                "bg-destructive text-destructive-foreground hover:bg-destructive/90",
              )}
            >
              {isBusy ? "Excluindo..." : confirmLabel}
            </AlertDialogPrimitive.Action>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
