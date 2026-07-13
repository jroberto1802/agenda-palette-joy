import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Em modo visualização, o conteúdo só entra em edição após duplo clique.
 * Um clique simples não abre/ativa o controle.
 */
export function EditableOnDoubleClick({
  editing,
  locked = false,
  forceEditable = false,
  onStartEdit,
  onEndEdit,
  className,
  children,
}: {
  editing: boolean;
  locked?: boolean;
  forceEditable?: boolean;
  onStartEdit: () => void;
  onEndEdit: () => void;
  className?: string;
  children: (editable: boolean) => ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isEditable = !locked && (forceEditable || editing);

  useEffect(() => {
    if (!editing || forceEditable || locked) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onEndEdit();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editing, forceEditable, locked, onEndEdit]);

  useEffect(() => {
    if (!editing || forceEditable || locked) return;
    const timer = window.setTimeout(() => {
      const focusable = containerRef.current?.querySelector<HTMLElement>(
        "input:not([type='hidden']), textarea, button:not([disabled]), [role='combobox']",
      );
      focusable?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [editing, forceEditable, locked]);

  if (locked) {
    return <div className={className}>{children(false)}</div>;
  }

  if (isEditable) {
    return (
      <div ref={containerRef} className={className}>
        {children(true)}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-md outline-none transition-colors hover:bg-muted/40",
        className,
      )}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onStartEdit();
      }}
      title="Duplo clique para editar"
    >
      <div className="pointer-events-none select-none">{children(false)}</div>
    </div>
  );
}
