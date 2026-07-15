import { Check, Pencil, Reply, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  CommentBody,
  CommentMentionInput,
  type MentionPessoa,
} from "@/components/common/comment-mention-input";
import { ConfirmDeleteDialog } from "@/components/common/confirm-delete-dialog";
import { ProfileAvatar } from "@/components/common/profile-avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Papel, Profile } from "@/types";
import {
  canMutateComentario,
  getComentarioEditadoLabel,
} from "@/utils/comentarios";
import { formatDateTime } from "@/utils/formatters";

export type ThreadComentario = {
  id: string;
  conteudo: string;
  created_at: string;
  usuario_id: string | null;
  parent_id?: string | null;
  editado_em?: string | null;
  editado_por?: string | null;
  usuario: {
    id: string;
    nome_completo: string;
    avatar_url?: string | null;
    papel?: Papel | null;
  } | null;
  editor?: {
    id: string;
    nome_completo: string;
    avatar_url?: string | null;
  } | null;
};

function commentPreview(conteudo: string) {
  const trimmed = conteudo.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 80) return trimmed;
  return `${trimmed.slice(0, 80)}…`;
}

export function CommentsThread({
  comentarios,
  pessoasMencionaveis,
  currentUserId,
  currentUserProfile,
  canComment,
  /** Quando false, desativa edição/exclusão (ex.: avisos). */
  allowMutate = true,
  highlightId = null,
  idPrefix,
  pending = false,
  emptyLabel = "Nenhum comentário ainda.",
  onSubmit,
  onDelete,
  onEdit,
}: {
  comentarios: ThreadComentario[];
  pessoasMencionaveis: MentionPessoa[];
  currentUserId?: string;
  currentUserProfile?: Profile | null;
  canComment: boolean;
  allowMutate?: boolean;
  highlightId?: string | null;
  idPrefix: string;
  pending?: boolean;
  emptyLabel?: string;
  onSubmit: (conteudo: string, parentId: string | null) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onEdit?: (id: string, conteudo: string) => Promise<void>;
}) {
  const [texto, setTexto] = useState("");
  const [replyingTo, setReplyingTo] = useState<ThreadComentario | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<ThreadComentario | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTexto, setEditTexto] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const profileForPerms = useMemo(() => {
    if (currentUserProfile) return currentUserProfile;
    if (!currentUserId) return null;
    return { id: currentUserId, papel: "usuario" as Papel } as Profile;
  }, [currentUserProfile, currentUserId]);

  // Atualiza a janela de 20 min sem precisar recarregar a página.
  useEffect(() => {
    if (!allowMutate) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [allowMutate]);

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

  const startEdit = (c: ThreadComentario) => {
    setEditingId(c.id);
    setEditTexto(c.conteudo);
    setReplyingTo(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTexto("");
  };

  const saveEdit = async () => {
    if (!editingId || !onEdit || !editTexto.trim() || editSaving) return;
    setEditSaving(true);
    try {
      await onEdit(editingId, editTexto.trim());
      cancelEdit();
    } finally {
      setEditSaving(false);
    }
  };

  const renderItem = (c: ThreadComentario, isReply: boolean) => {
    const canMutate =
      allowMutate &&
      canMutateComentario(profileForPerms, c, nowMs) &&
      (!!onDelete || !!onEdit);
    const editLabel = getComentarioEditadoLabel(c);
    const isEditing = editingId === c.id;

    return (
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
            {editLabel && (
              <p className="text-xs italic text-muted-foreground">{editLabel}</p>
            )}
            {!isEditing && (
              <div className="ml-auto flex items-center gap-1">
                {canComment && !isReply && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs text-muted-foreground opacity-0 group-hover:opacity-100"
                    onClick={() => {
                      setReplyingTo(c);
                      cancelEdit();
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
                {canMutate && onEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    aria-label="Editar comentário"
                    onClick={() => startEdit(c)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
                {canMutate && onDelete && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    aria-label="Excluir comentário"
                    onClick={() => setDeleting(c)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {isEditing ? (
            <div className="mt-2 space-y-2">
              <CommentMentionInput
                value={editTexto}
                onChange={setEditTexto}
                pessoas={pessoasMencionaveis}
                disabled={editSaving}
                autoFocus
                placeholder="Editar comentário..."
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="gap-1"
                  disabled={!editTexto.trim() || editSaving}
                  onClick={() => void saveEdit()}
                >
                  <Check className="h-3.5 w-3.5" />
                  {editSaving ? "Salvando..." : "Salvar"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={editSaving}
                  onClick={cancelEdit}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <CommentBody content={c.conteudo} pessoas={pessoasMencionaveis} className="mt-0.5" />
          )}
        </div>
      </div>
    );
  };

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
            disabled={pending || submitting || !!editingId}
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
            disabled={!texto.trim() || pending || submitting || !!editingId}
          >
            {replyingTo ? "Responder" : "Comentar"}
          </Button>
        </div>
      )}

      <ConfirmDeleteDialog
        open={!!deleting}
        onOpenChange={(next) => {
          if (!next) setDeleting(null);
        }}
        itemKind="comentário"
        itemName={deleting ? commentPreview(deleting.conteudo) : null}
        onConfirm={async () => {
          if (!deleting || !onDelete) return;
          await onDelete(deleting.id);
        }}
      />
    </div>
  );
}
