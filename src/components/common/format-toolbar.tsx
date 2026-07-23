import type { Editor } from "@tiptap/react";
import { Bold, Highlighter, Italic, Underline as UnderlineIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { HIGHLIGHT_COLORS } from "@/utils/rich-text";

/** Barra flutuante: Negrito, Itálico, Sublinhado, Marca-texto (5 cores). */
export function FormatToolbar({ editor }: { editor: Editor }) {
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    const update = () => setTick((n) => n + 1);
    editor.on("selectionUpdate", update);
    editor.on("transaction", update);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("transaction", update);
    };
  }, [editor]);

  const bold = editor.isActive("bold");
  const italic = editor.isActive("italic");
  const underline = editor.isActive("underline");
  const highlight = editor.isActive("highlight");
  const highlightColor = (editor.getAttributes("highlight").color as string | undefined) ?? null;

  return (
    <div className="z-50 flex items-center gap-0.5 rounded-lg border bg-popover p-1 shadow-md">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn("h-7 w-7", bold && "bg-accent")}
        aria-label="Negrito"
        aria-pressed={bold}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn("h-7 w-7", italic && "bg-accent")}
        aria-label="Itálico"
        aria-pressed={italic}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn("h-7 w-7", underline && "bg-accent")}
        aria-label="Sublinhado"
        aria-pressed={underline}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="h-3.5 w-3.5" />
      </Button>

      <Popover open={highlightOpen} onOpenChange={setHighlightOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn("h-7 w-7", highlight && "bg-accent")}
            aria-label="Marca-texto"
            aria-pressed={highlight}
            onMouseDown={(e) => e.preventDefault()}
          >
            <Highlighter className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-auto p-2"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <p className="mb-2 px-0.5 text-xs font-medium text-muted-foreground">Marca-texto</p>
          <div className="flex items-center gap-1.5">
            {HIGHLIGHT_COLORS.map((c) => {
              const active =
                highlight && highlightColor?.toLowerCase() === c.color.toLowerCase();
              return (
                <button
                  key={c.id}
                  type="button"
                  title={c.label}
                  aria-label={c.label}
                  className={cn(
                    "h-6 w-6 rounded-full border border-black/10 shadow-sm transition-transform hover:scale-110",
                    active && "ring-2 ring-primary ring-offset-1",
                  )}
                  style={{ backgroundColor: c.color }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    editor.chain().focus().unsetHighlight().setHighlight({ color: c.color }).run();
                    setHighlightOpen(false);
                  }}
                />
              );
            })}
            {highlight && (
              <button
                type="button"
                className="ml-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  editor.chain().focus().unsetHighlight().run();
                  setHighlightOpen(false);
                }}
              >
                Remover
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
