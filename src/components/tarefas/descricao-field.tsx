import { RichTextDisplay } from "@/components/common/rich-text-display";
import { RichTextEditor } from "@/components/common/rich-text-editor";
import { cn } from "@/lib/utils";
import { stripHtml } from "@/utils/rich-text";

/**
 * Campo de descrição de tarefa/subtarefa.
 * - Leitura: HTML sanitizado (mesmo conteúdo da prévia do card), sem TipTap.
 * - Edição: TipTap montado já com o valor atual (evita campo vazio por race no load).
 */
export function DescricaoField({
  value,
  onChange,
  onBlur,
  editable,
  disabled,
  placeholder = "Adicione uma descrição... (duplo clique para editar)",
  minHeightClassName = "[&_.ProseMirror]:min-h-[6rem]",
  readMinHeightClassName = "min-h-[6rem]",
  editorKey,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  editable: boolean;
  disabled?: boolean;
  placeholder?: string;
  minHeightClassName?: string;
  /** Altura mínima do bloco em modo leitura (Tailwind). */
  readMinHeightClassName?: string;
  /** Remonta o editor ao trocar de item (ex.: tarefaId). */
  editorKey?: string;
}) {
  const hasContent = !!stripHtml(value);

  if (!editable) {
    return (
      <div
        className={cn(
          "rounded-xl border bg-card text-card-foreground shadow-sm",
          readMinHeightClassName,
        )}
      >
        {hasContent ? (
          <RichTextDisplay
            content={value}
            className="px-3 py-2 text-sm text-card-foreground [&_mark]:!text-neutral-900"
          />
        ) : (
          <p className="px-3 py-2 text-sm text-muted-foreground">{placeholder}</p>
        )}
      </div>
    );
  }

  return (
    <RichTextEditor
      key={editorKey ?? "descricao-editor"}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      placeholder={placeholder}
      disabled={disabled}
      readOnly={false}
      autoFocus
      minHeightClassName={minHeightClassName}
    />
  );
}
