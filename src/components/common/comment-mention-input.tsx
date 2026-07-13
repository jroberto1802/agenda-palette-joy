import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ProfileAvatar } from "@/components/common/profile-avatar";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type MentionPessoa = {
  id: string;
  nome_completo: string;
  avatar_url?: string | null;
};

function getMentionQuery(value: string, caret: number): { start: number; query: string } | null {
  const before = value.slice(0, caret);
  const match = before.match(/(^|[\s([{])@([^\s@]*)$/);
  if (!match) return null;
  const query = match[2] ?? "";
  const start = caret - query.length - 1;
  return { start, query };
}

/** Destaca @Nome Completo no texto do comentário. */
export function CommentBody({
  content,
  pessoas,
  className,
}: {
  content: string;
  pessoas: MentionPessoa[];
  className?: string;
}) {
  const nodes = useMemo(() => {
    if (!content) return [content];
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
      if (match.index > last) {
        parts.push(content.slice(last, match.index));
      }
      parts.push(
        <span key={`m-${key++}`} className="font-medium text-primary">
          {match[0]}
        </span>,
      );
      last = match.index + match[0].length;
    }
    if (last < content.length) parts.push(content.slice(last));
    return parts.length > 0 ? parts : [content];
  }, [content, pessoas]);

  return (
    <p className={cn("whitespace-pre-wrap text-sm text-muted-foreground", className)}>
      {nodes}
    </p>
  );
}

/** Textarea com autocomplete de menções ao digitar @. */
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = !q
      ? pessoas
      : pessoas.filter((p) => p.nome_completo.toLowerCase().includes(q));
    return list.slice(0, 8);
  }, [pessoas, query]);

  const syncMention = (nextValue: string, caret: number) => {
    const mention = getMentionQuery(nextValue, caret);
    if (!mention) {
      setOpen(false);
      setQuery("");
      setMentionStart(null);
      return;
    }
    setOpen(true);
    setQuery(mention.query);
    setMentionStart(mention.start);
    setActiveIndex(0);
  };

  const insertMention = (pessoa: MentionPessoa) => {
    const el = textareaRef.current;
    if (!el || mentionStart == null) return;
    const caret = el.selectionStart ?? value.length;
    const before = value.slice(0, mentionStart);
    const after = value.slice(caret);
    const insertion = `@${pessoa.nome_completo} `;
    const next = `${before}${insertion}${after}`;
    onChange(next);
    setOpen(false);
    setQuery("");
    setMentionStart(null);
    requestAnimationFrame(() => {
      const pos = before.length + insertion.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  useEffect(() => {
    if (!open) return;
    if (filtered.length === 0) setActiveIndex(0);
    else if (activeIndex >= filtered.length) setActiveIndex(0);
  }, [open, filtered.length, activeIndex]);

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        disabled={disabled}
        rows={rows}
        autoFocus={autoFocus}
        placeholder={placeholder}
        className={className}
        onChange={(e) => {
          const next = e.target.value;
          onChange(next);
          syncMention(next, e.target.selectionStart ?? next.length);
        }}
        onClick={(e) => {
          const el = e.currentTarget;
          syncMention(el.value, el.selectionStart ?? el.value.length);
        }}
        onKeyUp={(e) => {
          const el = e.currentTarget;
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
            syncMention(el.value, el.selectionStart ?? el.value.length);
          }
        }}
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
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 150);
        }}
      />

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

      {open && filtered.length === 0 && query.trim() && (
        <div className="absolute bottom-full left-0 z-50 mb-1 w-full rounded-md border bg-popover px-3 py-2 text-sm text-muted-foreground shadow-md">
          Nenhuma pessoa encontrada
        </div>
      )}
    </div>
  );
}
