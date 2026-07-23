import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef } from "react";
import { FormatToolbar } from "@/components/common/format-toolbar";
import { cn } from "@/lib/utils";
import {
  normalizeRichTextOutput,
  toEditorHtml,
} from "@/utils/rich-text";

export function RichTextEditor({
  value,
  onChange,
  onBlur,
  placeholder,
  disabled,
  readOnly,
  className,
  minHeightClassName = "[&_.ProseMirror]:min-h-[4.5rem]",
  autoFocus,
  variant = "card",
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  /** Classes Tailwind com seletor do ProseMirror, ex: [&_.ProseMirror]:min-h-[12rem] */
  minHeightClassName?: string;
  autoFocus?: boolean;
  variant?: "card" | "plain";
}) {
  const editable = !disabled && !readOnly;
  const lastEmitted = useRef(normalizeRichTextOutput(value));

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        blockquote: false,
        horizontalRule: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
      }),
      Underline,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({
        placeholder: placeholder ?? "",
      }),
    ],
    content: toEditorHtml(value),
    editable,
    onUpdate: ({ editor: ed }) => {
      const next = normalizeRichTextOutput(ed.getHTML());
      lastEmitted.current = next;
      onChange(next);
    },
    onBlur: () => onBlur?.(),
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    if (!editor) return;
    const incoming = normalizeRichTextOutput(value);
    if (incoming === lastEmitted.current) return;
    const current = normalizeRichTextOutput(editor.getHTML());
    if (incoming === current) {
      lastEmitted.current = incoming;
      return;
    }
    lastEmitted.current = incoming;
    editor.commands.setContent(toEditorHtml(incoming), { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    if (!editor || !autoFocus || !editable) return;
    const t = window.setTimeout(() => editor.commands.focus("end"), 0);
    return () => window.clearTimeout(t);
  }, [editor, autoFocus, editable]);

  const surface = cn(
    variant === "card"
      ? "rounded-xl border bg-card shadow-sm"
      : "rounded-md border bg-transparent shadow-sm",
    "focus-within:ring-1 focus-within:ring-ring",
    "[&_.ProseMirror]:px-3 [&_.ProseMirror]:py-2 [&_.ProseMirror]:outline-none [&_.ProseMirror]:text-sm",
    "[&_.ProseMirror_p]:my-1 [&_.ProseMirror_p]:leading-relaxed",
    "[&_.ProseMirror_mark]:rounded-sm [&_.ProseMirror_mark]:px-0.5",
    "[&_.ProseMirror_u]:underline",
    "[&_p.is-editor-empty:first-child::before]:pointer-events-none",
    "[&_p.is-editor-empty:first-child::before]:float-left",
    "[&_p.is-editor-empty:first-child::before]:h-0",
    "[&_p.is-editor-empty:first-child::before]:text-muted-foreground",
    "[&_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
    minHeightClassName,
    !editable && "cursor-default opacity-90",
  );

  if (!editor) {
    return (
      <div className={cn(surface, "px-3 py-2 text-sm text-muted-foreground", className)}>
        {placeholder}
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {editable && (
        <BubbleMenu
          editor={editor}
          options={{ placement: "top" }}
          shouldShow={({ editor: ed, state }) => ed.isEditable && !state.selection.empty}
        >
          <FormatToolbar editor={editor} />
        </BubbleMenu>
      )}
      <div className={surface}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
