import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  looksLikeHtml,
  sanitizeRichHtml,
  stripHtml,
  toEditorHtml,
} from "@/utils/rich-text";

const DISPLAY_PROSE =
  "[&_p]:my-1 [&_p]:leading-relaxed [&_mark]:rounded-sm [&_mark]:px-0.5 [&_u]:underline " +
  "[&_strong]:font-semibold [&_em]:italic";

/** Renderiza texto plano legado ou HTML rico sanitizado. */
export function RichTextDisplay({
  content,
  className,
  as: Comp = "div",
}: {
  content: string | null | undefined;
  className?: string;
  as?: "div" | "p" | "span";
}) {
  const html = useMemo(() => {
    if (!content) return "";
    if (!looksLikeHtml(content)) {
      // texto legado: escapa via toEditorHtml
      return sanitizeRichHtml(toEditorHtml(content));
    }
    return sanitizeRichHtml(content);
  }, [content]);

  if (!content || !stripHtml(content)) return null;

  return (
    <Comp
      className={cn("text-sm text-muted-foreground", DISPLAY_PROSE, className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
