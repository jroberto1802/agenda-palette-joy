import { useEffect, useState, type ReactNode } from "react";
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

  useEffect(() => {
    if (forceEdit) setEditing(true);
  }, [forceEdit]);

  if (!canEdit) {
    return <div className={className}>{display}</div>;
  }

  if (forceEdit || editing) {
    return (
      <div
        className={className}
        onBlur={(event) => {
          if (forceEdit) return;
          const next = event.relatedTarget as Node | null;
          if (next && event.currentTarget.contains(next)) return;
          // Atraso para selects/popovers Radix
          window.setTimeout(() => {
            if (!document.activeElement || !event.currentTarget.contains(document.activeElement)) {
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
