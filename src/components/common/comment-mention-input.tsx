import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FormatToolbar } from "@/components/common/format-toolbar";
import { ProfileAvatar } from "@/components/common/profile-avatar";
import { cn } from "@/lib/utils";
import {
  looksLikeHtml,
  normalizeRichTextOutput,
  sanitizeRichHtml,
  stripHtml,
  toEditorHtml,
} from "@/utils/rich-text";

export type MentionPessoa = {
  id: string;
  nome_completo: string;
  avatar_url?: string | null;
};

function getMentionQueryFromText(
  textBefore: string,
): { query: string; fromOffset: number } | null {
  const match = textBefore.match(/(^|[\s([{])@([^\s@]*)$/);
  if (!match) return null;
  const query = match[2] ?? "";
  const fromOffset = textBefore.length - query.length - 1;
  return { query, fromOffset };
}

/** Destaca @Nome e renderiza HTML rico sanitizado. */
export function CommentBody({
  content,
  pessoas,
  className,
}: {
  content: string;
  pessoas: MentionPessoa[];
  className?: string;
}) {
  const html = useMemo(() => {
    if (!content) return "";
    let base = looksLikeHtml(content)
      ? sanitizeRichHtml(content)
      : sanitizeRichHtml(toEditorHtml(content));

    const sorted = [...pessoas]
      .filter((p) => p.nome_completo.trim())
      .sort((a, b) => b.nome_completo.length - a.nome_completo.length);

    if (sorted.length === 0) return base;

    const pattern = new RegExp(
      `@(${sorted
        .map((p) => p.nome_completo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|")})`,
      "gi",
    );

    // Destaca menções apenas em trechos de texto (evita atributos HTML)
    return base.replace(/(>[^<]*)/g, (chunk) =>
      chunk.replace(
        pattern,
        (m) =>
          `<span class="font-medium text-primary">${m}</span>`,
      ),
    );
  }, [content, pessoas]);

  if (!content || !stripHtml(content)) {
    return (
      <p className={cn("whitespace-pre-wrap text-sm text-muted-foreground", className)} />
    );
  }

  // Conteúdo legado sem formatação: mantém preview simples com menções em React
  if (!looksLikeHtml(content)) {
    const nodes = buildPlainMentionNodes(content, pessoas);
    return (
      <p className={cn("whitespace-pre-wrap text-sm text-muted-foreground", className)}>
        {nodes}
      </p>
    );
  }

  return (
    <div
      className={cn(
        "text-sm text-muted-foreground",
        "[&_p]:my-0.5 [&_p]:leading-snug [&_mark]:rounded-sm [&_mark]:px-0.5 [&_u]:underline",
        "[&_mark]:!text-neutral-900 [&_strong]:font-semibold [&_em]:italic",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function buildPlainMentionNodes(content: string, pessoas: MentionPessoa[]): ReactNode[] {
  const sorted = [...pessoas]
    .filter((p) => p.nome_completo.trim())
    .sort((a, b) => b.nome_completo.length - a.nome_completo.length);

  if (sorted.length === 0) return [content];

  const pattern = new RegExp(
    `@(${sorted
      .map((p) => p.nome_completo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|")})`,
    "gi",
  );

  const parts: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(content)) !== null) {
    if (match.index > last) parts.push(content.slice(last, match.index));
    parts.push(
      <span key={`m-${key++}`} className="font-medium text-primary">
        {match[0]}
      </span>,
    );
    last = match.index + match[0].length;
  }
  if (last < content.length) parts.push(content.slice(last));
  return parts.length > 0 ? parts : [content];
}

/** Editor de comentário com @menções + formatação flutuante. */
export function CommentMentionInput({
  value,
  onChange,
  pessoas,
  placeholder = "Escreva um comentário... Use @ para mencionar",
  disabled,
  rows = 3,
  className,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  pessoas: MentionPessoa[];
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  className?: string;
  autoFocus?: boolean;
}) {
  const lastEmitted = useRef(normalizeRichTextOutput(value));
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mentionFrom, setMentionFrom] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const minH =
    rows <= 2
      ? "[&_.ProseMirror]:min-h-[3rem]"
      : rows >= 6
        ? "[&_.ProseMirror]:min-h-[9rem]"
        : "[&_.ProseMirror]:min-h-[4.5rem]";

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
      Placeholder.configure({ placeholder }),
    ],
    content: toEditorHtml(value),
    editable: !disabled,
    onUpdate: ({ editor: ed }) => {
      const next = normalizeRichTextOutput(ed.getHTML());
      lastEmitted.current = next;
      onChange(next);
      syncMentionFromEditor(ed);
    },
    onSelectionUpdate: ({ editor: ed }) => {
      syncMentionFromEditor(ed);
    },
  });

  function syncMentionFromEditor(ed: NonNullable<typeof editor>) {
    if (!ed) return;
    const { from } = ed.state.selection;
    const textBefore = ed.state.doc.textBetween(Math.max(0, from - 80), from, "\n", "\n");
    const mention = getMentionQueryFromText(textBefore);
    if (!mention) {
      setOpen(false);
      setQuery("");
      setMentionFrom(null);
      return;
    }
    setOpen(true);
    setQuery(mention.query);
    setMentionFrom(from - mention.query.length - 1);
    setActiveIndex(0);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = !q
      ? pessoas
      : pessoas.filter((p) => p.nome_completo.toLowerCase().includes(q));
    return list.slice(0, 8);
  }, [pessoas, query]);

  const insertMention = (pessoa: MentionPessoa) => {
    if (!editor || mentionFrom == null) return;
    const { from } = editor.state.selection;
    const insertion = `@${pessoa.nome_completo} `;
    editor
      .chain()
      .focus()
      .deleteRange({ from: mentionFrom, to: from })
      .insertContent(insertion)
      .run();
    setOpen(false);
    setQuery("");
    setMentionFrom(null);
  };

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

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
    if (!editor || !autoFocus || disabled) return;
    const t = window.setTimeout(() => editor.commands.focus("end"), 0);
    return () => window.clearTimeout(t);
  }, [editor, autoFocus, disabled]);

  useEffect(() => {
    if (!open) return;
    if (filtered.length === 0) setActiveIndex(0);
    else if (activeIndex >= filtered.length) setActiveIndex(0);
  }, [open, filtered.length, activeIndex]);

  if (!editor) {
    return (
      <div className={cn("rounded-md border px-3 py-2 text-sm text-muted-foreground", className)}>
        {placeholder}
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {!disabled && (
        <BubbleMenu
          editor={editor}
          options={{ placement: "top" }}
          shouldShow={({ editor: ed, state }) => ed.isEditable && !state.selection.empty}
        >
          <FormatToolbar editor={editor} />
        </BubbleMenu>
      )}

      <div
        className={cn(
          "rounded-md border bg-transparent shadow-sm focus-within:ring-1 focus-within:ring-ring",
          "[&_.ProseMirror]:px-3 [&_.ProseMirror]:py-2 [&_.ProseMirror]:outline-none [&_.ProseMirror]:text-sm",
          "[&_.ProseMirror]:text-foreground",
          "[&_.ProseMirror_p]:my-1 [&_.ProseMirror_p]:leading-relaxed",
          "[&_.ProseMirror_mark]:rounded-sm [&_.ProseMirror_mark]:px-0.5",
          "[&_.ProseMirror_mark]:!text-neutral-900",
          "[&_.ProseMirror_u]:underline",
          "[&_p.is-editor-empty:first-child::before]:pointer-events-none",
          "[&_p.is-editor-empty:first-child::before]:float-left",
          "[&_p.is-editor-empty:first-child::before]:h-0",
          "[&_p.is-editor-empty:first-child::before]:text-muted-foreground",
          "[&_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
          minH,
          disabled && "opacity-60",
        )}
        onKeyDown={(e) => {
          if (!open || filtered.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => (i + 1) % filtered.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
          } else if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            insertMention(filtered[activeIndex]);
          } else if (e.key === "Escape") {
            e.preventDefault();
            setOpen(false);
          }
        }}
      >
        <EditorContent editor={editor} />
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute bottom-full left-0 z-50 mb-1 max-h-56 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
          {filtered.map((pessoa, index) => (
            <button
              key={pessoa.id}
              type="button"
              className={cn(
                "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
                index === activeIndex && "bg-accent",
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(pessoa);
              }}
            >
              <ProfileAvatar
                name={pessoa.nome_completo}
                avatarUrl={pessoa.avatar_url}
                className="h-6 w-6"
              />
              <span className="truncate">{pessoa.nome_completo}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
