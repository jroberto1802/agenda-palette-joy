import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Exibe conteúdo em modo leitura; entra em edição só com duplo clique (exceto forceEdit). */
export function EditableSurface({
  canEdit,
  forceEdit = false,
  display,
  children,
  className,
  displayClassName,
}: {
  canEdit: boolean;
  /** Em criação/nova tarefa, campos já começam editáveis. */
  forceEdit?: boolean;
  display: ReactNode;
  children: ReactNode;
  className?: string;
  displayClassName?: string;
}) {
  const [editing, setEditing] = useState(forceEdit);
  const blurTimerRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (forceEdit) setEditing(true);
  }, [forceEdit]);

  useEffect(() => {
    return () => {
      if (blurTimerRef.current != null) {
        window.clearTimeout(blurTimerRef.current);
      }
    };
  }, []);

  if (!canEdit) {
    return <div className={className}>{display}</div>;
  }

  if (forceEdit || editing) {
    return (
      <div
        ref={containerRef}
        className={className}
        onBlur={(event) => {
          if (forceEdit) return;
          const next = event.relatedTarget as Node | null;
          if (next && event.currentTarget.contains(next)) return;
          if (blurTimerRef.current != null) {
            window.clearTimeout(blurTimerRef.current);
          }
          blurTimerRef.current = window.setTimeout(() => {
            const root = containerRef.current;
            if (!root) {
              setEditing(false);
              return;
            }
            if (!document.activeElement || !root.contains(document.activeElement)) {
              setEditing(false);
            }
          }, 150);
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn(className, displayClassName, "rounded-md")}
      onDoubleClick={() => setEditing(true)}
      title="Clique duas vezes para editar"
    >
      {display}
    </div>
  );
}
