import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EditableSurface } from "@/components/common/editable-surface";
import { PessoasMultiSelect } from "@/components/common/pessoas-multi-select";
import { ProfileAvatar } from "@/components/common/profile-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateSubtarefa,
  useDeleteSubtarefa,
  useToggleSubtarefa,
  useUpdateSubtarefa,
} from "@/hooks/use-tarefas";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import { cn } from "@/lib/utils";
import type {
  Profile,
  ProfileWithSetor,
  SubtarefaFormData,
  SubtarefaWithRelations,
  TarefaPrioridade,
} from "@/types";
import { TAREFA_PRIORIDADE_COLORS, TAREFA_PRIORIDADE_LABELS } from "@/utils/tarefas";

export type DraftSubtarefa = {
  localId: string;
  titulo: string;
  descricao: string;
  prioridade: TarefaPrioridade | null;
  data_prazo: Date | null;
  atribuido_ids: string[];
  concluida: boolean;
};

export function draftToFormData(drafts: DraftSubtarefa[]): SubtarefaFormData[] {
  return drafts
    .filter((d) => d.titulo.trim())
    .map((d) => ({
      titulo: d.titulo.trim(),
      descricao: d.descricao.trim() || null,
      prioridade: d.prioridade,
      data_prazo: d.data_prazo ? d.data_prazo.toISOString() : null,
      atribuido_ids: d.atribuido_ids,
    }));
}

function emptyDraft(criadorId?: string | null): DraftSubtarefa {
  return {
    localId: crypto.randomUUID(),
    titulo: "",
    descricao: "",
    prioridade: null,
    data_prazo: null,
    atribuido_ids: criadorId ? [criadorId] : [],
    concluida: false,
  };
}

function AvatarStack({
  people,
  emptyLabel = "Ninguém",
}: {
  people: { id: string; nome_completo: string; avatar_url?: string | null }[];
  emptyLabel?: string;
}) {
  if (people.length === 0) {
    return <span className="text-xs text-muted-foreground">{emptyLabel}</span>;
  }
  return (
    <div className="flex -space-x-1.5">
      {people.map((p) => (
        <ProfileAvatar
          key={p.id}
          name={p.nome_completo}
          avatarUrl={p.avatar_url}
          className="h-6 w-6 ring-2 ring-background"
        />
      ))}
    </div>
  );
}

function SubtarefaFields({
  canEdit,
  forceEdit,
  titulo,
  descricao,
  prioridade,
  dataPrazo,
  atribuidoIds,
  pessoas,
  criador,
  concluidoPor,
  concluida,
  onTituloChange,
  onDescricaoChange,
  onPrioridadeChange,
  onPrazoChange,
  onAtribuidoChange,
}: {
  canEdit: boolean;
  forceEdit: boolean;
  titulo: string;
  descricao: string;
  prioridade: TarefaPrioridade | null;
  dataPrazo: Date | null;
  atribuidoIds: string[];
  pessoas: Pick<ProfileWithSetor, "id" | "nome_completo" | "avatar_url">[];
  criador: Pick<Profile, "id" | "nome_completo" | "avatar_url"> | null;
  concluidoPor: Pick<Profile, "id" | "nome_completo" | "avatar_url"> | null;
  concluida: boolean;
  onTituloChange: (value: string) => void;
  onDescricaoChange: (value: string) => void;
  onPrioridadeChange: (value: TarefaPrioridade | null) => void;
  onPrazoChange: (value: Date | null) => void;
  onAtribuidoChange: (ids: string[]) => void;
}) {
  const responsaveis = pessoas.filter((p) => atribuidoIds.includes(p.id));

  return (
    <div className="min-w-0 flex-1 space-y-2">
      <EditableSurface
        canEdit={canEdit}
        forceEdit={forceEdit}
        display={
          <p
            className={cn(
              "text-sm font-medium",
              concluida && "text-muted-foreground line-through",
            )}
          >
            {titulo || "Sem título"}
          </p>
        }
      >
        <Input
          value={titulo}
          onChange={(e) => onTituloChange(e.target.value)}
          placeholder="Título da subtarefa *"
          className="h-8"
        />
      </EditableSurface>

      <EditableSurface
        canEdit={canEdit}
        forceEdit={forceEdit}
        display={
          <p className="text-xs text-muted-foreground">
            {descricao.trim() || "Sem descrição"}
          </p>
        }
      >
        <Textarea
          value={descricao}
          onChange={(e) => onDescricaoChange(e.target.value)}
          placeholder="Breve descrição (opcional)"
          rows={2}
          className="min-h-[56px] text-sm"
        />
      </EditableSurface>

      <div className="flex flex-wrap items-center gap-2">
        <EditableSurface
          canEdit={canEdit}
          forceEdit={forceEdit}
          display={
            prioridade ? (
              <Badge variant="outline" className={TAREFA_PRIORIDADE_COLORS[prioridade]}>
                {prioridade}
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">Sem prioridade</span>
            )
          }
        >
          <Select
            value={prioridade ?? "none"}
            onValueChange={(v) =>
              onPrioridadeChange(v === "none" ? null : (v as TarefaPrioridade))
            }
          >
            <SelectTrigger className="h-8 w-[140px]">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem prioridade</SelectItem>
              {(Object.keys(TAREFA_PRIORIDADE_LABELS) as TarefaPrioridade[]).map((p) => (
                <SelectItem key={p} value={p}>
                  {TAREFA_PRIORIDADE_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </EditableSurface>

        <EditableSurface
          canEdit={canEdit}
          forceEdit={forceEdit}
          display={
            <span className="text-xs text-muted-foreground">
              {dataPrazo
                ? format(dataPrazo, "dd/MM/yyyy", { locale: ptBR })
                : "Sem prazo"}
            </span>
          }
        >
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5" />
                {dataPrazo
                  ? format(dataPrazo, "dd/MM/yyyy", { locale: ptBR })
                  : "Prazo"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dataPrazo ?? undefined}
                onSelect={(d) => onPrazoChange(d ?? null)}
                locale={ptBR}
                initialFocus
              />
              {dataPrazo && (
                <div className="border-t p-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => onPrazoChange(null)}
                  >
                    Remover prazo
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </EditableSurface>

        <EditableSurface
          canEdit={canEdit}
          forceEdit={forceEdit}
          display={<AvatarStack people={responsaveis} emptyLabel="Sem responsáveis" />}
        >
          <div className="w-64">
            <PessoasMultiSelect
              pessoas={pessoas}
              value={atribuidoIds}
              onChange={onAtribuidoChange}
              placeholder="Responsáveis"
              showSelectAll={false}
            />
          </div>
        </EditableSurface>

        {criador && (
          <div className="flex items-center gap-1.5" title={`Criado por ${criador.nome_completo}`}>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Criou
            </span>
            <ProfileAvatar
              name={criador.nome_completo}
              avatarUrl={criador.avatar_url}
              className="h-6 w-6"
            />
          </div>
        )}

        {concluida && concluidoPor && (
          <div
            className="flex items-center gap-1.5"
            title={`Concluída por ${concluidoPor.nome_completo}`}
          >
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Concluiu
            </span>
            <ProfileAvatar
              name={concluidoPor.nome_completo}
              avatarUrl={concluidoPor.avatar_url}
              className="h-6 w-6"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function PersistedSubtarefaRow({
  sub,
  canEdit,
  pessoas,
  profile,
}: {
  sub: SubtarefaWithRelations;
  canEdit: boolean;
  pessoas: Pick<ProfileWithSetor, "id" | "nome_completo" | "avatar_url">[];
  profile: Pick<Profile, "id" | "nome_completo" | "avatar_url"> | null | undefined;
}) {
  const updateSubtarefa = useUpdateSubtarefa();
  const toggleSubtarefa = useToggleSubtarefa();
  const deleteSubtarefa = useDeleteSubtarefa();

  const [titulo, setTitulo] = useState(sub.titulo);
  const [descricao, setDescricao] = useState(sub.descricao ?? "");

  useEffect(() => {
    setTitulo(sub.titulo);
    setDescricao(sub.descricao ?? "");
  }, [sub.id, sub.titulo, sub.descricao]);

  const persist = async (data: Parameters<typeof updateSubtarefa.mutateAsync>[0]["data"]) => {
    try {
      await updateSubtarefa.mutateAsync({ id: sub.id, data });
    } catch (error) {
      toast.error("Erro ao atualizar subtarefa", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  const flushText = () => {
    const nextTitulo = titulo.trim();
    if (!nextTitulo) {
      setTitulo(sub.titulo);
      return;
    }
    const patch: { titulo?: string; descricao?: string | null } = {};
    if (nextTitulo !== sub.titulo) patch.titulo = nextTitulo;
    if ((descricao.trim() || null) !== (sub.descricao ?? null)) {
      patch.descricao = descricao.trim() || null;
    }
    if (Object.keys(patch).length > 0) void persist(patch);
  };

  return (
    <div className="group flex items-start gap-2 rounded-lg border bg-card/40 p-3">
      <Checkbox
        className="mt-1"
        checked={sub.concluida}
        disabled={!canEdit}
        onCheckedChange={async (checked) => {
          try {
            await toggleSubtarefa.mutateAsync({ id: sub.id, concluida: !!checked });
          } catch (error) {
            toast.error(getSupabaseErrorMessage(error as Error));
          }
        }}
      />
      <div className="min-w-0 flex-1" onBlur={flushText}>
        <SubtarefaFields
          canEdit={canEdit}
          forceEdit={false}
          titulo={titulo}
          descricao={descricao}
          prioridade={sub.prioridade}
          dataPrazo={sub.data_prazo ? new Date(sub.data_prazo) : null}
          atribuidoIds={sub.responsaveis?.map((r) => r.usuario_id) ?? []}
          pessoas={pessoas}
          criador={sub.criador ?? profile ?? null}
          concluidoPor={sub.concluido_por_usuario}
          concluida={sub.concluida}
          onTituloChange={setTitulo}
          onDescricaoChange={setDescricao}
          onPrioridadeChange={(prioridade) => void persist({ prioridade })}
          onPrazoChange={(date) =>
            void persist({ data_prazo: date ? date.toISOString() : null })
          }
          onAtribuidoChange={(atribuido_ids) => void persist({ atribuido_ids })}
        />
      </div>
      {canEdit && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100"
          onClick={async () => {
            try {
              await deleteSubtarefa.mutateAsync(sub.id);
            } catch (error) {
              toast.error(getSupabaseErrorMessage(error as Error));
            }
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

function DraftSubtarefaRow({
  draft,
  canEdit,
  pessoas,
  profile,
  onChange,
  onRemove,
}: {
  draft: DraftSubtarefa;
  canEdit: boolean;
  pessoas: Pick<ProfileWithSetor, "id" | "nome_completo" | "avatar_url">[];
  profile: Pick<Profile, "id" | "nome_completo" | "avatar_url"> | null | undefined;
  onChange: (next: DraftSubtarefa) => void;
  onRemove: () => void;
}) {
  return (
    <div className="group flex items-start gap-2 rounded-lg border border-dashed bg-muted/20 p-3">
      <Checkbox className="mt-1" checked={draft.concluida} disabled />
      <SubtarefaFields
        canEdit={canEdit}
        forceEdit
        titulo={draft.titulo}
        descricao={draft.descricao}
        prioridade={draft.prioridade}
        dataPrazo={draft.data_prazo}
        atribuidoIds={draft.atribuido_ids}
        pessoas={pessoas}
        criador={profile ?? null}
        concluidoPor={null}
        concluida={draft.concluida}
        onTituloChange={(titulo) => onChange({ ...draft, titulo })}
        onDescricaoChange={(descricao) => onChange({ ...draft, descricao })}
        onPrioridadeChange={(prioridade) => onChange({ ...draft, prioridade })}
        onPrazoChange={(data_prazo) => onChange({ ...draft, data_prazo })}
        onAtribuidoChange={(atribuido_ids) => onChange({ ...draft, atribuido_ids })}
      />
      {canEdit && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100"
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

export function TarefaSubtarefasSection({
  tarefaId,
  subtarefas,
  canEdit,
  isCreate,
  pessoas,
  profile,
  drafts,
  onDraftsChange,
}: {
  tarefaId: string | null;
  subtarefas: SubtarefaWithRelations[];
  canEdit: boolean;
  isCreate: boolean;
  pessoas: Pick<ProfileWithSetor, "id" | "nome_completo" | "avatar_url">[];
  profile: Pick<Profile, "id" | "nome_completo" | "avatar_url"> | null | undefined;
  drafts: DraftSubtarefa[];
  onDraftsChange: (drafts: DraftSubtarefa[]) => void;
}) {
  const createSubtarefa = useCreateSubtarefa();
  const [adding, setAdding] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState("");

  const concluidas = subtarefas.filter((s) => s.concluida).length;
  const total = isCreate ? drafts.length : subtarefas.length;
  const done = isCreate ? drafts.filter((d) => d.concluida).length : concluidas;

  const handleAddPersisted = async () => {
    if (!tarefaId || !novoTitulo.trim()) return;
    try {
      await createSubtarefa.mutateAsync({
        tarefaId,
        titulo: novoTitulo.trim(),
        atribuido_ids: profile?.id ? [profile.id] : [],
      });
      setNovoTitulo("");
      setAdding(false);
    } catch (error) {
      toast.error("Erro ao adicionar subtarefa", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          Subtarefas {total > 0 && `(${done}/${total})`}
        </h3>
      </div>

      <div className="space-y-2">
        {isCreate
          ? drafts.map((draft) => (
              <DraftSubtarefaRow
                key={draft.localId}
                draft={draft}
                canEdit={canEdit}
                pessoas={pessoas}
                profile={profile}
                onChange={(next) =>
                  onDraftsChange(drafts.map((d) => (d.localId === next.localId ? next : d)))
                }
                onRemove={() =>
                  onDraftsChange(drafts.filter((d) => d.localId !== draft.localId))
                }
              />
            ))
          : subtarefas.map((sub) => (
              <PersistedSubtarefaRow
                key={sub.id}
                sub={sub}
                canEdit={canEdit}
                pessoas={pessoas}
                profile={profile}
              />
            ))}
      </div>

      {canEdit && isCreate && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 gap-1.5"
          onClick={() => onDraftsChange([...drafts, emptyDraft(profile?.id)])}
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar subtarefa
        </Button>
      )}

      {canEdit && !isCreate && tarefaId && (
        <div className="mt-3 space-y-2">
          {adding ? (
            <div className="flex gap-2">
              <Input
                autoFocus
                placeholder="Título da subtarefa..."
                value={novoTitulo}
                onChange={(e) => setNovoTitulo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleAddPersisted();
                  }
                  if (e.key === "Escape") {
                    setAdding(false);
                    setNovoTitulo("");
                  }
                }}
              />
              <Button
                type="button"
                size="icon"
                onClick={() => void handleAddPersisted()}
                disabled={!novoTitulo.trim() || createSubtarefa.isPending}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setAdding(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar subtarefa
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
