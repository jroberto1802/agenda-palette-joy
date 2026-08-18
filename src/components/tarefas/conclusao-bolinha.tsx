import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { Check } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Acima de Dialog/Sheet (z-50) e do drawer de subtarefa (z-[70]). */
const OVERLAY_Z = "z-[120]";

type NestedModalLock = {
  lock: () => void;
  unlock: () => void;
  isLocked: () => boolean;
};

const NestedModalLockContext = createContext<NestedModalLock | null>(null);

/**
 * Impede que o Dialog/Sheet pai feche quando um AlertDialog (confirmação)
 * abre por cima — o Radix trata o foco no portal como "clique fora".
 */
export function useNestedModalLock() {
  const countRef = useRef(0);
  const lock = useCallback(() => {
    countRef.current += 1;
  }, []);
  const unlock = useCallback(() => {
    countRef.current = Math.max(0, countRef.current - 1);
  }, []);
  const isLocked = useCallback(() => countRef.current > 0, []);
  return useMemo(() => ({ lock, unlock, isLocked }), [lock, unlock, isLocked]);
}

export function NestedModalLockProvider({
  value,
  children,
}: {
  value: NestedModalLock;
  children: ReactNode;
}) {
  return (
    <NestedModalLockContext.Provider value={value}>{children}</NestedModalLockContext.Provider>
  );
}

export function isNestedOverlayEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return !!target.closest(
    "[role='alertdialog'], [data-radix-alert-dialog-overlay], [data-radix-popper-content-wrapper], [role='listbox'], [data-radix-select-content]",
  );
}

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
  const nestedLock = useContext(NestedModalLockContext);
  const guardHeldRef = useRef(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const holdGuard = () => {
    if (guardHeldRef.current) return;
    guardHeldRef.current = true;
    nestedLock?.lock();
  };

  const releaseGuard = () => {
    if (!guardHeldRef.current) return;
    guardHeldRef.current = false;
    nestedLock?.unlock();
  };

  const handleClick = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled || pending) return;
    if (concluida) {
      void onToggle(false);
      return;
    }
    holdGuard();
    setConfirmOpen(true);
  };

  const handleConfirm = async (event: MouseEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      await onToggle(true);
      setConfirmOpen(false);
      releaseGuard();
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
          "relative z-10 flex shrink-0 items-center justify-center rounded-full border-2 bg-background transition-colors",
          size === "sm" ? "h-5 w-5" : "h-6 w-6",
          concluida
            ? "border-green-500 bg-green-500 text-white"
            : "border-muted-foreground/70 text-transparent hover:border-primary",
          disabled && "cursor-not-allowed opacity-60",
          className,
        )}
      >
        <Check className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} strokeWidth={3} />
      </button>

      <AlertDialogPrimitive.Root
        open={confirmOpen}
        onOpenChange={(next) => {
          setConfirmOpen(next);
          if (!next) releaseGuard();
        }}
      >
        <AlertDialogPrimitive.Portal>
          <AlertDialogPrimitive.Overlay
            className={cn(
              "fixed inset-0 pointer-events-auto bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              OVERLAY_Z,
            )}
          />
          <AlertDialogPrimitive.Content
            className={cn(
              "fixed left-[50%] top-[50%] grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 pointer-events-auto data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg",
              OVERLAY_Z,
            )}
            onClick={(event) => event.stopPropagation()}
            onCloseAutoFocus={(event) => event.preventDefault()}
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
                type="button"
                disabled={pending}
                className={cn(buttonVariants({ variant: "outline" }), "mt-2 sm:mt-0")}
              >
                Cancelar
              </AlertDialogPrimitive.Cancel>
              <AlertDialogPrimitive.Action
                type="button"
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
