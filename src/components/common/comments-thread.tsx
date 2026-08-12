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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ComentarioReacao, Papel, Profile } from "@/types";
import {
  canMutateComentario,
  getComentarioEditadoLabel,
} from "@/utils/comentarios";
import { formatDateTime } from "@/utils/formatters";
import {
  pessoaDesativadaNomeClassName,
} from "@/utils/pessoas-display";
import { stripHtml } from "@/utils/rich-text";

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
    ativo?: boolean | null;
  } | null;
  editor?: {
    id: string;
    nome_completo: string;
    avatar_url?: string | null;
    ativo?: boolean | null;
  } | null;
  reacoes?: ComentarioReacao[];
};

function commentPreview(conteudo: string) {
  const trimmed = stripHtml(conteudo).replace(/\s+/g, " ").trim();
  if (trimmed.length <= 80) return trimmed;
  return `${trimmed.slice(0, 80)}…`;
}

function CommentReacoes({
  reacoes,
  currentUserId,
  canReact,
  reacting,
  onToggle,
}: {
  reacoes: ComentarioReacao[];
  currentUserId?: string;
  canReact: boolean;
  reacting: boolean;
  onToggle?: () => Promise<void>;
}) {
  const count = reacoes.length;
  // true = esta pessoa já reagiu → ícone verde; false = ainda não → ícone cinza
  const reactedByMe = !!currentUserId && reacoes.some((r) => r.usuario_id === currentUserId);
  const sorted = useMemo(
    () =>
      [...reacoes].sort((a, b) =>
        (a.usuario?.nome_completo ?? "").localeCompare(b.usuario?.nome_completo ?? "", "pt-BR"),
      ),
    [reacoes],
  );

  return (
    <div className="mt-1 flex items-center gap-1">
      {canReact && onToggle && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-6 w-6 shrink-0",
            reactedByMe
              ? "text-green-600 hover:bg-green-50 hover:text-green-700"
              : "text-zinc-400 hover:bg-muted hover:text-zinc-500",
          )}
          aria-label={reactedByMe ? "Remover reação" : "Reagir"}
          aria-pressed={reactedByMe}
          disabled={reacting}
          onClick={() => void onToggle()}
        >
          {/*
            Lógica do ícone de Reagir:
            - padrão (não reagiu): check cinza
            - ativado (reagiu): check verde
          */}
          <Check
            className={cn(
              "h-3.5 w-3.5 stroke-[2.5]",
              reactedByMe ? "text-green-600" : "text-zinc-400",
            )}
            aria-hidden
          />
        </Button>
      )}

      {count > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex h-6 items-center gap-1 rounded-full border px-1.5 text-xs transition-colors",
                reactedByMe
                  ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                  : "border-border bg-muted/40 text-muted-foreground hover:bg-muted",
              )}
              aria-label={`${count} reação${count === 1 ? "" : "ões"}`}
            >
              <Check className="h-3 w-3 text-green-600" aria-hidden />
              <span>{count}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-2">
            <p className="mb-1.5 px-1 text-xs font-medium text-muted-foreground">
              Quem reagiu
            </p>
            <ul className="max-h-48 space-y-1 overflow-y-auto">
              {sorted.map((r) => (
                <li key={r.usuario_id} className="flex items-center gap-2 rounded-md px-1 py-1">
                  <ProfileAvatar
                    name={r.usuario?.nome_completo ?? "?"}
                    avatarUrl={r.usuario?.avatar_url}
                    ativo={r.usuario?.ativo}
                    className="h-6 w-6 shrink-0"
                  />
                  <span
                    className={cn(
                      "truncate text-sm",
                      pessoaDesativadaNomeClassName(r.usuario),
                    )}
                  >
                    {r.usuario?.nome_completo ?? "Usuário"}
                    {r.usuario_id === currentUserId ? " (você)" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

export function CommentsThread({
  comentarios,
  pessoasMencionaveis,
  currentUserId,
  currentUserProfile,
  canComment,
  /** Quando false, desativa edição/exclusão (ex.: avisos). */
  allowMutate = true,
  canReact = true,
  highlightId = null,
  idPrefix,
  pending = false,
  emptyLabel = "Nenhum comentário ainda.",
  compact = false,
  onSubmit,
  onDelete,
  onEdit,
  onToggleReacao,
}: {
  comentarios: ThreadComentario[];
  pessoasMencionaveis: MentionPessoa[];
  currentUserId?: string;
  currentUserProfile?: Profile | null;
  canComment: boolean;
  allowMutate?: boolean;
  /** Permite reagir (check). Default true quando onToggleReacao é passado. */
  canReact?: boolean;
  highlightId?: string | null;
  idPrefix: string;
  pending?: boolean;
  emptyLabel?: string;
  /** Densidade reduzida (drawer compacto da subtarefa). */
  compact?: boolean;
  onSubmit: (conteudo: string, parentId: string | null) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onEdit?: (id: string, conteudo: string) => Promise<void>;
  onToggleReacao?: (comentarioId: string) => Promise<void>;
}) {
  const [texto, setTexto] = useState("");
  const [replyingTo, setReplyingTo] = useState<ThreadComentario | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<ThreadComentario | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTexto, setEditTexto] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [reactingId, setReactingId] = useState<string | null>(null);
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

  const handleToggleReacao = async (comentarioId: string) => {
    if (!onToggleReacao || reactingId) return;
    setReactingId(comentarioId);
    try {
      await onToggleReacao(comentarioId);
    } finally {
      setReactingId(null);
    }
  };

  const renderItem = (c: ThreadComentario, isReply: boolean) => {
    const canMutate =
      allowMutate &&
      canMutateComentario(profileForPerms, c, nowMs) &&
      (!!onDelete || !!onEdit);
    const editLabel = getComentarioEditadoLabel(c);
    const isEditing = editingId === c.id;
    const reacoes = c.reacoes ?? [];

    return (
      <div
        key={c.id}
        id={`${idPrefix}-${c.id}`}
        className={cn(
          "group flex rounded-lg p-2 transition-colors",
          compact ? "gap-2" : "gap-3",
          isReply && (compact ? "ml-5 border-l-2 border-muted pl-2" : "ml-8 border-l-2 border-muted pl-3"),
          highlightId === c.id && "bg-primary/10 ring-1 ring-primary/40",
        )}
      >
        <ProfileAvatar
          name={c.usuario?.nome_completo ?? "?"}
          avatarUrl={c.usuario?.avatar_url}
          ativo={c.usuario?.ativo}
          className={cn("shrink-0", compact ? "h-6 w-6" : "h-8 w-8")}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
            <p
              className={cn(
                "font-medium leading-tight",
                compact ? "text-xs" : "text-sm",
                pessoaDesativadaNomeClassName(c.usuario),
              )}
            >
              {c.usuario?.nome_completo}
            </p>
            <p className="text-xs leading-tight text-muted-foreground">
              {formatDateTime(c.created_at)}
            </p>
            {editLabel && (
              <p className="text-xs italic leading-tight text-muted-foreground">{editLabel}</p>
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
            <>
              <CommentBody
                content={c.conteudo}
                pessoas={pessoasMencionaveis}
                className="mt-0 leading-snug"
              />
              {onToggleReacao && (
                <CommentReacoes
                  reacoes={reacoes}
                  currentUserId={currentUserId}
                  canReact={canReact}
                  reacting={reactingId === c.id}
                  onToggle={() => handleToggleReacao(c.id)}
                />
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={cn(compact ? "space-y-3" : "space-y-4")}>
      <div className={cn(compact ? "space-y-2" : "space-y-3")}>
        {roots.length === 0 && (
          <p className={cn("text-muted-foreground", compact ? "text-xs" : "text-sm")}>
            {emptyLabel}
          </p>
        )}
        {roots.map((root) => (
          <div key={root.id} className="space-y-2">
            {renderItem(root, false)}
            {(repliesByParent.get(root.id) ?? []).map((reply) => renderItem(reply, true))}
          </div>
        ))}
      </div>

      {canComment && (
        <div className={cn("space-y-2 border-t", compact ? "pt-2" : "pt-3")}>
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
