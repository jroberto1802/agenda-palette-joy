import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, Eye, Trash2, UserRound } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { ConfirmDeleteDialog } from "@/components/common/confirm-delete-dialog";
import { PessoasMultiSelect } from "@/components/common/pessoas-multi-select";
import { ProfileAvatar } from "@/components/common/profile-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type {
  ProfileWithSetor,
  SubtarefaWithAuthors,
  TarefaVisibilidade,
  TarefaWithRelations,
} from "@/types";
import {
  TAREFA_PRIORIDADE_BAND_CLASS,
  TAREFA_VISIBILIDADE_LABELS,
  TAREFA_VISIBILIDADE_OPTIONS,
} from "@/utils/tarefas";

/** Acima de Dialog/Sheet (z-50) e do drawer de subtarefa (z-[70]). */
const META_OVERLAY_Z = "z-[100]";

export function MinhaAgendaBadge({
  tarefa,
  className,
}: {
  tarefa: Pick<TarefaWithRelations, "visibilidade">;
  className?: string;
}) {
  if (tarefa.visibilidade !== "somente_para_mim") return null;
  return (
    <Badge variant="outline" className={cn("text-xs", className)}>
      Minha agenda
    </Badge>
  );
}

function AuthorAvatar({
  name,
  avatarUrl,
  label,
}: {
  name: string;
  avatarUrl?: string | null;
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex shrink-0" aria-label={`${label}: ${name}`}>
          <ProfileAvatar name={name} avatarUrl={avatarUrl} className="h-5 w-5" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className={META_OVERLAY_Z}>
        <p className="text-xs">
          {label}: {name}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

function MetaIconButton({
  label,
  active,
  disabled,
  children,
  className,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          className={cn(
            "h-7 w-7 shrink-0 rounded-md text-muted-foreground hover:text-foreground",
            active && "bg-muted text-foreground",
            className,
          )}
          aria-label={label}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className={META_OVERLAY_Z}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function SubtarefaRow({
  subtarefa,
  canEdit,
  pessoasDisponiveis,
  onOpen,
  onToggle,
  onDelete,
  onUpdateMeta,
  dragHandle,
  isDragging,
}: {
  subtarefa: SubtarefaWithAuthors;
  canEdit: boolean;
  pessoasDisponiveis: ProfileWithSetor[];
  onOpen: () => void;
  onToggle: (concluida: boolean) => Promise<void>;
  onDelete: () => Promise<void>;
  onUpdateMeta: (meta: {
    data_vencimento?: string | null;
    atribuido_ids?: string[];
    visibilidade?: SubtarefaWithAuthors["visibilidade"];
  }) => Promise<void>;
  dragHandle?: ReactNode;
  isDragging?: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const criadorNome = subtarefa.criador?.nome_completo ?? "Desconhecido";
  const concluidoNome = subtarefa.concluido_por_usuario?.nome_completo;

  const responsaveis = useMemo(
    () =>
      (subtarefa.responsaveis ?? [])
        .map((r) => r.usuario)
        .filter((u): u is NonNullable<typeof u> => !!u),
    [subtarefa.responsaveis],
  );

  const responsavelIds = useMemo(
    () => (subtarefa.responsaveis ?? []).map((r) => r.usuario_id),
    [subtarefa.responsaveis],
  );

  const prazoDate = subtarefa.data_vencimento
    ? new Date(subtarefa.data_vencimento)
    : null;

  const runMeta = async (
    meta: {
      data_vencimento?: string | null;
      atribuido_ids?: string[];
      visibilidade?: SubtarefaWithAuthors["visibilidade"];
    },
  ) => {
    setSaving(true);
    try {
      await onUpdateMeta(meta);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={cn(
        "group flex items-start gap-2.5 overflow-hidden rounded-xl border border-l-4 bg-card px-3 py-3 shadow-sm",
        TAREFA_PRIORIDADE_BAND_CLASS[subtarefa.prioridade],
        isDragging && "opacity-60 ring-2 ring-primary",
      )}
    >
      {dragHandle}
      <Checkbox
        checked={subtarefa.concluida}
        disabled={!canEdit || saving}
        className="mt-0.5"
        onCheckedChange={async (checked) => {
          await onToggle(!!checked);
        }}
      />

      <button
        type="button"
        className={cn(
          "min-w-0 flex-1 rounded-md px-1 py-0.5 text-left text-sm leading-snug outline-none transition-colors hover:bg-muted/40 focus-visible:ring-1 focus-visible:ring-ring",
          subtarefa.concluida && "text-muted-foreground line-through",
        )}
        onClick={onOpen}
        title="Abrir detalhes da subtarefa"
      >
        <span className="block whitespace-normal break-words">{subtarefa.titulo}</span>
      </button>

      <TooltipProvider delayDuration={200}>
        <div
          className="flex shrink-0 items-center gap-0.5"
          onClick={(event) => event.stopPropagation()}
        >
          {/* Prazo */}
          <Popover>
            <PopoverTrigger asChild>
              <span>
                <MetaIconButton
                  label={
                    prazoDate
                      ? `Prazo: ${format(prazoDate, "dd/MM/yyyy", { locale: ptBR })}`
                      : "Prazo"
                  }
                  active={!!prazoDate}
                  disabled={!canEdit || saving}
                >
                  {prazoDate ? (
                    <span className="text-[10px] font-medium leading-none">
                      {format(prazoDate, "dd/MM", { locale: ptBR })}
                    </span>
                  ) : (
                    <CalendarClock className="h-3.5 w-3.5" />
                  )}
                </MetaIconButton>
              </span>
            </PopoverTrigger>
            <PopoverContent className={cn("w-auto p-0", META_OVERLAY_Z)} align="end">
              <Calendar
                mode="single"
                selected={prazoDate ?? undefined}
                onSelect={(date) =>
                  void runMeta({
                    data_vencimento: date ? date.toISOString() : null,
                  })
                }
                locale={ptBR}
                initialFocus
              />
              {prazoDate && (
                <div className="border-t p-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => void runMeta({ data_vencimento: null })}
                  >
                    Remover data
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>

          {/* Responsáveis */}
          <Popover>
            <PopoverTrigger asChild>
              <span>
                <MetaIconButton
                  label={
                    responsaveis.length
                      ? `Responsáveis: ${responsaveis.map((r) => r.nome_completo).join(", ")}`
                      : "Responsáveis"
                  }
                  active={responsaveis.length > 0}
                  disabled={!canEdit || saving}
                >
                  {responsaveis.length > 0 ? (
                    <span className="flex -space-x-1.5">
                      {responsaveis.slice(0, 2).map((pessoa) => (
                        <ProfileAvatar
                          key={pessoa.id}
                          name={pessoa.nome_completo}
                          avatarUrl={pessoa.avatar_url}
                          className="h-4 w-4 ring-1 ring-background"
                        />
                      ))}
                    </span>
                  ) : (
                    <UserRound className="h-3.5 w-3.5" />
                  )}
                </MetaIconButton>
              </span>
            </PopoverTrigger>
            <PopoverContent className={cn("w-80 space-y-2 p-3", META_OVERLAY_Z)} align="end">
              <p className="text-xs font-medium text-muted-foreground">Responsáveis</p>
              <PessoasMultiSelect
                pessoas={pessoasDisponiveis}
                value={responsavelIds}
                onChange={(ids) => void runMeta({ atribuido_ids: ids })}
                disabled={!canEdit || saving}
                placeholder="Nenhum responsável"
                emptyLabel="Nenhuma pessoa disponível nesta atividade"
                showSelectAll
              />
            </PopoverContent>
          </Popover>

          {/* Visibilidade */}
          <Popover>
            <PopoverTrigger asChild>
              <span>
                <MetaIconButton
                  label={
                    subtarefa.visibilidade
                      ? `Visibilidade: ${TAREFA_VISIBILIDADE_LABELS[subtarefa.visibilidade]}`
                      : "Visibilidade"
                  }
                  active={!!subtarefa.visibilidade}
                  disabled={!canEdit || saving}
                >
                  <Eye className="h-3.5 w-3.5" />
                </MetaIconButton>
              </span>
            </PopoverTrigger>
            <PopoverContent className={cn("w-64 space-y-2 p-3", META_OVERLAY_Z)} align="end">
              <p className="text-xs font-medium text-muted-foreground">Visibilidade</p>
              <Select
                value={subtarefa.visibilidade ?? "none"}
                onValueChange={(value) =>
                  void runMeta({
                    visibilidade:
                      value === "none" ? null : (value as TarefaVisibilidade),
                  })
                }
                disabled={!canEdit || saving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Herdar da tarefa" />
                </SelectTrigger>
                <SelectContent className={META_OVERLAY_Z}>
                  <SelectItem value="none">Herdar da tarefa</SelectItem>
                  {TAREFA_VISIBILIDADE_OPTIONS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {TAREFA_VISIBILIDADE_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PopoverContent>
          </Popover>

          <AuthorAvatar
            name={criadorNome}
            avatarUrl={subtarefa.criador?.avatar_url}
            label="Criado por"
          />
          {subtarefa.concluida && concluidoNome && (
            <AuthorAvatar
              name={concluidoNome}
              avatarUrl={subtarefa.concluido_por_usuario?.avatar_url}
              label="Concluído por"
            />
          )}

          {canEdit && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100"
              onClick={() => setConfirmDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </TooltipProvider>

      <ConfirmDeleteDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        itemKind="subtarefa"
        itemName={subtarefa.titulo}
        onConfirm={onDelete}
      />
    </div>
  );
}
