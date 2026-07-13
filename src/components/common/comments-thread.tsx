import { Reply, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  CommentBody,
  CommentMentionInput,
  type MentionPessoa,
} from "@/components/common/comment-mention-input";
import { ProfileAvatar } from "@/components/common/profile-avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/utils/formatters";

export type ThreadComentario = {
  id: string;
  conteudo: string;
  created_at: string;
  usuario_id: string | null;
  parent_id?: string | null;
  usuario: {
    id: string;
    nome_completo: string;
    avatar_url?: string | null;
  } | null;
};

export function CommentsThread({
  comentarios,
  pessoasMencionaveis,
  currentUserId,
  canComment,
  canDeleteOwn = true,
  highlightId = null,
  idPrefix,
  pending = false,
  emptyLabel = "Nenhum comentário ainda.",
  onSubmit,
  onDelete,
}: {
  comentarios: ThreadComentario[];
  pessoasMencionaveis: MentionPessoa[];
  currentUserId?: string;
  canComment: boolean;
  canDeleteOwn?: boolean;
  highlightId?: string | null;
  idPrefix: string;
  pending?: boolean;
  emptyLabel?: string;
  onSubmit: (conteudo: string, parentId: string | null) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}) {
  const [texto, setTexto] = useState("");
  const [replyingTo, setReplyingTo] = useState<ThreadComentario | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const roots = useMemo(
    () => comentarios.filter((c) => !c.parent_id),
    [comentarios],
  );

  const repliesByParent = useMemo(() => {
    const map = new Map<string, ThreadComentario[]>();
    for (const c of comentarios) {
      if (!c.parent_id) continue;
      const list = map.get(c.parent_id) ?? [];
      list.push(c);
      map.set(c.parent_id, list);
    }
    return map;
  }, [comentarios]);

  const handleSubmit = async () => {
    if (!texto.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(texto.trim(), replyingTo?.id ?? null);
      setTexto("");
      setReplyingTo(null);
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = (c: ThreadComentario, isReply: boolean) => (
    <div
      key={c.id}
      id={`${idPrefix}-${c.id}`}
      className={cn(
        "group flex gap-3 rounded-lg p-2 transition-colors",
        isReply && "ml-8 border-l-2 border-muted pl-3",
        highlightId === c.id && "bg-primary/10 ring-1 ring-primary/40",
      )}
    >
      <ProfileAvatar
        name={c.usuario?.nome_completo ?? "?"}
        avatarUrl={c.usuario?.avatar_url}
        className="h-8 w-8 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{c.usuario?.nome_completo}</p>
          <p className="text-xs text-muted-foreground">{formatDateTime(c.created_at)}</p>
          <div className="ml-auto flex items-center gap-1">
            {canComment && !isReply && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground opacity-0 group-hover:opacity-100"
                onClick={() => {
                  setReplyingTo(c);
                  setTexto((prev) =>
                    prev.trim()
                      ? prev
                      : c.usuario?.nome_completo
                        ? `@${c.usuario.nome_completo} `
                        : "",
                  );
                }}
              >
                <Reply className="h-3 w-3" />
                Responder
              </Button>
            )}
            {canDeleteOwn && onDelete && c.usuario_id === currentUserId && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100"
                onClick={() => void onDelete(c.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        <CommentBody content={c.conteudo} pessoas={pessoasMencionaveis} className="mt-0.5" />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {roots.length === 0 && (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        )}
        {roots.map((root) => (
          <div key={root.id} className="space-y-2">
            {renderItem(root, false)}
            {(repliesByParent.get(root.id) ?? []).map((reply) => renderItem(reply, true))}
          </div>
        ))}
      </div>

      {canComment && (
        <div className="space-y-2 border-t pt-3">
          {replyingTo && (
            <div className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1.5 text-xs">
              <span className="truncate text-muted-foreground">
                Respondendo a{" "}
                <span className="font-medium text-foreground">
                  {replyingTo.usuario?.nome_completo ?? "comentário"}
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setReplyingTo(null)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          <CommentMentionInput
            value={texto}
            onChange={setTexto}
            pessoas={pessoasMencionaveis}
            disabled={pending || submitting}
            autoFocus={!!replyingTo}
            placeholder={
              replyingTo
                ? "Escreva sua resposta... Use @ para mencionar"
                : "Escreva um comentário... Use @ para mencionar"
            }
          />
          <Button
            type="button"
            size="sm"
            onClick={() => void handleSubmit()}
            disabled={!texto.trim() || pending || submitting}
          >
            {replyingTo ? "Responder" : "Comentar"}
          </Button>
        </div>
      )}
    </div>
  );
}
