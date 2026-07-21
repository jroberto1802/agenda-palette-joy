import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronRight, GripVertical, MessageSquare, Paperclip, Plus, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { CommentsThread } from "@/components/common/comments-thread";
import { EditableOnDoubleClick } from "@/components/common/editable-on-double-click";
import { SubtarefaPanelSheet } from "@/components/tarefas/subtarefa-panel-sheet";
import { SubtarefaRow } from "@/components/tarefas/subtarefa-row";
import { MoverSubtarefaDialog } from "@/components/tarefas/mover-subtarefa-dialog";
import { TarefaAnexosSection } from "@/components/tarefas/tarefa-anexos-section";
import { TarefaMetaToolbar } from "@/components/tarefas/tarefa-meta-toolbar";
import { TarefaPeopleStrip } from "@/components/tarefas/tarefa-people-strip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { usePessoas } from "@/hooks/use-pessoas";
import { useProjetos } from "@/hooks/use-projetos";
import { useProfile } from "@/hooks/use-profile";
import { LARGE_MODAL_CONTENT_CLASS } from "@/lib/layout";
import { useSetores } from "@/hooks/use-setores";
import { listProjetoMembros } from "@/services/projetos";
import { useQuery } from "@tanstack/react-query";
import {
  useCreateSubtarefa,
  useCreateTarefa,
  useCreateTarefaComentario,
  useDeleteSubtarefa,
  useDeleteTarefaComentario,
  useDuplicateSubtarefa,
  useReorderSubtarefas,
  useTarefaDetail,
  useToggleSubtarefa,
  useUpdateSubtarefaMeta,
  useUpdateTarefa,
  useUpdateTarefaComentario,
} from "@/hooks/use-tarefas";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import type {
  ProfileWithSetor,
  RecorrenciaConfig,
  RecorrenciaTipo,
  SubtarefaWithAuthors,
  TarefaAnexo,
  TarefaComentario,
  TarefaFormData,
  TarefaVisibilidade,
  TarefaWithRelations,
} from "@/types";
import { parseRecorrencia } from "@/utils/recorrencia";
import { isAdmin, isGerente } from "@/utils/permissions";
import {
  TAREFA_PRIORIDADE_COLORS,
  canCommentOrAttachTarefa,
  canEditTarefa,
  canEditVisibilidade,
  getSetoresPermitidos,
  getTarefaConclusaoColorClass,
  getTarefaConclusaoLabel,
  parseLembretes,
  partitionSubtarefaIdsByConclusao,
  sortSubtarefasList,
} from "@/utils/tarefas";

const tarefaPanelSchema = z
  .object({
    titulo: z.string().min(2, "Título deve ter pelo menos 2 caracteres"),
    descricao: z.string(),
    projeto_id: z.string().nullable(),
    setor_id: z.string().nullable(),
    atribuido_ids: z.array(z.string()).min(1, "Selecione ao menos um responsável"),
    prioridade: z.enum(["P1", "P2", "P3", "P4"]),
    data_inicio: z.date().nullable(),
    tagsInput: z.string(),
    visibilidade: z.enum([
      "todos_empresa",
      "todos_setor",
      "todos_projeto",
      "somente_para_mim",
      "pessoas_especificas",
    ]),
    observador_ids: z.array(z.string()),
    lembretes: z.array(z.enum(["no_prazo", "1h_antes", "1d_antes", "1sem_antes"])),
    recorrencia_tipo: z.enum(["nenhuma", "diaria", "semanal", "mensal"]),
    recorrencia_dias_semana: z.array(z.number()),
    recorrencia_dia_mes: z.number().min(1).max(28),
    recorrencia_data_fim: z.date().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.visibilidade === "todos_setor" && !data.setor_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Setor é obrigatório para visibilidade "Todos do setor".',
        path: ["setor_id"],
      });
    }
    if (data.visibilidade === "todos_projeto" && !data.projeto_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Projeto é obrigatório para visibilidade "Todos do projeto".',
        path: ["projeto_id"],
      });
    }
    if (data.visibilidade === "pessoas_especificas" && data.observador_ids.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecione ao menos uma pessoa.",
        path: ["observador_ids"],
      });
    }
  });

type TarefaPanelSchema = z.infer<typeof tarefaPanelSchema>;

type EditableTarefaField = "titulo" | "descricao";

const EMPTY_SUBTAREFAS: SubtarefaWithAuthors[] = [];
const EMPTY_COMENTARIOS: TarefaComentario[] = [];
const EMPTY_ANEXOS: TarefaAnexo[] = [];

function parseTags(input: string): string[] {
  return input
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function SortableSubtarefaRow({
  subtarefa,
  canEdit,
  pessoasDisponiveis,
  onOpen,
  onToggle,
  onDuplicate,
  onMove,
  onDelete,
  onUpdateMeta,
}: {
  subtarefa: SubtarefaWithAuthors;
  canEdit: boolean;
  pessoasDisponiveis: ProfileWithSetor[];
  onOpen: () => void;
  onToggle: (concluida: boolean) => Promise<void>;
  onDuplicate: () => void;
  onMove: () => void;
  onDelete: () => Promise<void>;
  onUpdateMeta: (meta: {
    data_inicio?: string | null;
    atribuido_ids?: string[];
    visibilidade?: SubtarefaWithAuthors["visibilidade"];
  }) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: subtarefa.id,
    disabled: !canEdit,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <SubtarefaRow
        subtarefa={subtarefa}
        canEdit={canEdit}
        pessoasDisponiveis={pessoasDisponiveis}
        onOpen={onOpen}
        onToggle={onToggle}
        onDuplicate={onDuplicate}
        onMove={onMove}
        onDelete={onDelete}
        onUpdateMeta={onUpdateMeta}
        isDragging={isDragging}
        dragHandle={
          canEdit ? (
            <button
              type="button"
              className="mt-0.5 shrink-0 cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted"
              aria-label="Arrastar para reordenar"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          ) : undefined
        }
      />
    </div>
  );
}

function toFormValues(
  tarefa?: TarefaWithRelations | null,
  defaultProjetoId?: string | null,
  defaultDataInicio?: Date | null,
  defaultAtribuidoIds?: string[],
): TarefaPanelSchema {
  const rec = parseRecorrencia(tarefa?.recorrencia);
  const atribuidoIds =
    tarefa?.responsaveis?.map((r) => r.usuario_id) ??
    (tarefa?.atribuido_a ? [tarefa.atribuido_a] : []);

  return {
    titulo: tarefa?.titulo ?? "",
    descricao: tarefa?.descricao ?? "",
    projeto_id: tarefa?.projeto_id ?? defaultProjetoId ?? null,
    setor_id: tarefa?.setor_id ?? null,
    atribuido_ids: atribuidoIds.length
      ? atribuidoIds
      : (defaultAtribuidoIds ?? []),
    prioridade: tarefa?.prioridade ?? "P4",
    data_inicio: tarefa?.data_inicio
      ? new Date(tarefa.data_inicio)
      : defaultDataInicio
        ? new Date(defaultDataInicio)
        : null,
    tagsInput: tarefa?.tags?.join(", ") ?? "",
    visibilidade: (tarefa?.visibilidade as TarefaVisibilidade | undefined) ?? "somente_para_mim",
    observador_ids: tarefa?.observadores?.map((o) => o.usuario_id) ?? [],
    lembretes: parseLembretes(tarefa?.lembretes),
    recorrencia_tipo: rec?.tipo ?? "nenhuma",
    recorrencia_dias_semana: rec?.dias_semana ?? [],
    recorrencia_dia_mes: rec?.dia_mes ?? 1,
    recorrencia_data_fim: rec?.data_fim ? new Date(rec.data_fim) : null,
  };
}

function toRecorrenciaPayload(values: TarefaPanelSchema): RecorrenciaConfig | null {
  if (values.recorrencia_tipo === "nenhuma") return null;
  return {
    tipo: values.recorrencia_tipo as RecorrenciaTipo,
    dias_semana:
      values.recorrencia_tipo === "semanal" ? values.recorrencia_dias_semana : undefined,
    dia_mes: values.recorrencia_tipo === "mensal" ? values.recorrencia_dia_mes : undefined,
    data_fim: values.recorrencia_data_fim ? values.recorrencia_data_fim.toISOString() : null,
  };
}

function toPayload(values: TarefaPanelSchema): TarefaFormData {
  return {
    titulo: values.titulo,
    descricao: values.descricao,
    projeto_id: values.projeto_id,
    setor_id: values.setor_id,
    atribuido_ids: values.atribuido_ids,
    atribuido_a: values.atribuido_ids[0] ?? null,
    prioridade: values.prioridade,
    data_inicio: values.data_inicio ? values.data_inicio.toISOString() : null,
    tags: parseTags(values.tagsInput),
    recorrencia: toRecorrenciaPayload(values),
    visibilidade: values.visibilidade,
    observador_ids: values.observador_ids,
    lembretes: values.lembretes,
  };
}

export function TarefaPanelSheet({
  tarefaId,
  open,
  onOpenChange,
  readOnly = false,
  onSaved,
  defaultProjetoId = null,
  defaultDataInicio = null,
  defaultAtribuidoIds,
  lockProjeto = false,
  initialAba,
  highlightComentarioId = null,
  initialSubtarefaId = null,
}: {
  tarefaId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readOnly?: boolean;
  onSaved?: (tarefaId: string) => void;
  defaultProjetoId?: string | null;
  /** Pré-preenche o campo Data ao criar tarefa. */
  defaultDataInicio?: Date | null;
  /** Pré-preenche responsáveis ao criar tarefa. */
  defaultAtribuidoIds?: string[];
  lockProjeto?: boolean;
  initialAba?: "comentarios" | "anexos";
  highlightComentarioId?: string | null;
  initialSubtarefaId?: string | null;
}) {
  const isCreate = !tarefaId;
  const { data: profile } = useProfile();
  const { data: setores } = useSetores();
  const { data: projetos } = useProjetos();
  const { data: pessoas } = usePessoas();
  const { data: tarefa, isLoading } = useTarefaDetail(tarefaId);

  const createTarefa = useCreateTarefa();
  const updateTarefa = useUpdateTarefa();
  const createSubtarefa = useCreateSubtarefa();
  const toggleSubtarefa = useToggleSubtarefa();
  const updateSubtarefaMeta = useUpdateSubtarefaMeta();
  const deleteSubtarefa = useDeleteSubtarefa();
  const duplicateSubtarefa = useDuplicateSubtarefa();
  const reorderSubtarefas = useReorderSubtarefas();
  const createComentario = useCreateTarefaComentario();
  const deleteComentario = useDeleteTarefaComentario();
  const updateComentario = useUpdateTarefaComentario();

  const [novaSubtarefa, setNovaSubtarefa] = useState("");
  const [subtarefaOrder, setSubtarefaOrder] = useState<string[]>([]);
  const [subtarefaDrawerId, setSubtarefaDrawerId] = useState<string | null>(null);
  const [movingSubtarefa, setMovingSubtarefa] = useState<SubtarefaWithAuthors | null>(null);
  const [sideTab, setSideTab] = useState<"comentarios" | "anexos">(
    initialAba ?? "comentarios",
  );
  const [editingField, setEditingField] = useState<EditableTarefaField | null>(null);

  useEffect(() => {
    if (!open) {
      setEditingField(null);
      setSubtarefaDrawerId(null);
      return;
    }
    setEditingField(null);
  }, [open, tarefaId]);

  useEffect(() => {
    if (!open) return;
    setSideTab(initialAba ?? "comentarios");
  }, [open, initialAba, tarefaId]);

  useEffect(() => {
    if (!open || !initialSubtarefaId) return;
    setSubtarefaDrawerId(initialSubtarefaId);
  }, [open, initialSubtarefaId, tarefaId]);

  useEffect(() => {
    if (!open || !highlightComentarioId || initialSubtarefaId) return;
    setSideTab("comentarios");
    const timer = window.setTimeout(() => {
      document
        .getElementById(`tarefa-comentario-${highlightComentarioId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [open, highlightComentarioId, initialSubtarefaId, tarefa?.comentarios]);

  const pessoasAtivas = useMemo(
    () => (pessoas ?? []).filter((p) => p.ativo),
    [pessoas],
  );

  const setoresPermitidos = useMemo(
    () =>
      getSetoresPermitidos(
        setores ?? [],
        profile ?? null,
        isAdmin(profile),
        isGerente(profile),
      ),
    [setores, profile],
  );

  const canEdit = useMemo(() => {
    if (readOnly) return false;
    if (isCreate) return true;
    if (!tarefa || !profile) return false;
    return canEditTarefa(
      tarefa,
      profile.id,
      isAdmin(profile),
      isGerente(profile),
      profile.setor_id,
    );
  }, [readOnly, isCreate, tarefa, profile]);

  /** Visualizadores (e quem tem leitura) podem comentar/anexar sem editar campos. */
  const canCommentOrAttach = useMemo(
    () => canCommentOrAttachTarefa(tarefa, profile?.id, readOnly),
    [tarefa, profile?.id, readOnly],
  );

  const canEditVisibility = useMemo(() => {
    if (readOnly) return false;
    if (isCreate) return true;
    return canEditVisibilidade(
      tarefa ?? null,
      profile?.id,
      isAdmin(profile),
      isGerente(profile),
      profile?.setor_id,
    );
  }, [readOnly, isCreate, tarefa, profile]);

  const form = useForm<TarefaPanelSchema>({
    resolver: zodResolver(tarefaPanelSchema),
    defaultValues: toFormValues(
      null,
      defaultProjetoId,
      defaultDataInicio,
      defaultAtribuidoIds,
    ),
  });

  const projetoId = form.watch("projeto_id");
  const setorId = form.watch("setor_id");
  const atribuidoIds = form.watch("atribuido_ids");
  const observadorIds = form.watch("observador_ids");
  const visibilidade = form.watch("visibilidade");
  const selectedProjeto = projetos?.find((p) => p.id === projetoId);
  const selectedSetor = setores?.find((s) => s.id === setorId);

  const { data: projetoMembros } = useQuery({
    queryKey: ["projeto-membros", projetoId],
    queryFn: () => listProjetoMembros(projetoId!),
    enabled: !!projetoId,
  });

  const pessoasParaResponsavel = useMemo(() => {
    if (!projetoId) return pessoasAtivas;
    const memberIds = new Set((projetoMembros ?? []).map((m) => m.id));
    const selected = new Set(atribuidoIds ?? []);
    // Equipe do projeto + já atribuídos (mesmo se removidos da equipe)
    return pessoasAtivas.filter((p) => memberIds.has(p.id) || selected.has(p.id));
  }, [projetoId, projetoMembros, pessoasAtivas, atribuidoIds]);

  const defaultAtribuidoIdsKey = (defaultAtribuidoIds ?? []).join(",");
  const defaultDataInicioKey = defaultDataInicio
    ? defaultDataInicio.getTime()
    : null;

  useEffect(() => {
    if (!open) return;
    form.reset(
      toFormValues(
        tarefa ?? null,
        defaultProjetoId,
        tarefaId ? null : defaultDataInicio,
        tarefaId ? undefined : defaultAtribuidoIds,
      ),
    );
    setNovaSubtarefa("");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- defaults via keys estáveis
  }, [open, tarefa, tarefaId, defaultProjetoId, defaultDataInicioKey, defaultAtribuidoIdsKey, form]);

  const criadorDisplay = useMemo(() => {
    if (tarefa?.criador) return tarefa.criador;
    if (profile) {
      return {
        id: profile.id,
        nome_completo: profile.nome_completo,
        avatar_url: profile.avatar_url,
      };
    }
    return null;
  }, [tarefa, profile]);

  const responsaveisDisplay = useMemo(() => {
    const byId = new Map(pessoasAtivas.map((p) => [p.id, p]));
    return (atribuidoIds ?? [])
      .map((id) => byId.get(id))
      .filter((p): p is (typeof pessoasAtivas)[number] => !!p)
      .map((p) => ({
        id: p.id,
        nome_completo: p.nome_completo,
        avatar_url: p.avatar_url,
      }));
  }, [atribuidoIds, pessoasAtivas]);

  const visualizadoresDisplay = useMemo(() => {
    const byId = new Map(pessoasAtivas.map((p) => [p.id, p]));
    return (observadorIds ?? [])
      .map((id) => byId.get(id))
      .filter((p): p is (typeof pessoasAtivas)[number] => !!p)
      .map((p) => ({
        id: p.id,
        nome_completo: p.nome_completo,
        avatar_url: p.avatar_url,
      }));
  }, [observadorIds, pessoasAtivas]);

  const subtarefas = tarefa?.subtarefas ?? EMPTY_SUBTAREFAS;
  const comentarios = tarefa?.comentarios ?? EMPTY_COMENTARIOS;
  const anexos = tarefa?.anexos ?? EMPTY_ANEXOS;
  const concluidas = subtarefas.filter((s) => s.concluida).length;

  const subtarefaOrderKey = useMemo(
    () =>
      subtarefas
        .map((s) => `${s.id}:${s.concluida ? 1 : 0}:${s.posicao ?? 0}`)
        .join(","),
    [subtarefas],
  );

  useEffect(() => {
    const next = sortSubtarefasList(subtarefas).map((s) => s.id);
    setSubtarefaOrder((prev) => (prev.join(",") === next.join(",") ? prev : next));
  }, [subtarefaOrderKey]); // subtarefas está refletido em subtarefaOrderKey

  const subtarefasById = useMemo(
    () => new Map(subtarefas.map((s) => [s.id, s])),
    [subtarefas],
  );
  const orderedSubtarefas = subtarefaOrder
    .map((id) => subtarefasById.get(id))
    .filter((s): s is SubtarefaWithAuthors => !!s);

  const subtarefaSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const applySubtarefaConclusaoOrder = (subtarefaId: string, concluida: boolean) => {
    const optimistic = subtarefas.map((s) =>
      s.id === subtarefaId ? { ...s, concluida } : s,
    );
    setSubtarefaOrder(sortSubtarefasList(optimistic).map((s) => s.id));
  };

  const handleSubtarefaDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !tarefaId || active.id === over.id || !canEdit) return;
    const oldIndex = subtarefaOrder.indexOf(String(active.id));
    const newIndex = subtarefaOrder.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const moved = arrayMove(subtarefaOrder, oldIndex, newIndex);
    const next = partitionSubtarefaIdsByConclusao(moved, subtarefasById);
    setSubtarefaOrder(next);
    void reorderSubtarefas
      .mutateAsync({ tarefaId, orderedIds: next })
      .catch((error) => {
        toast.error("Erro ao reordenar subtarefas", {
          description: getSupabaseErrorMessage(error as Error),
        });
      });
  };

  const pessoasMencionaveis = useMemo(() => {
    const ids = new Set<string>([...(atribuidoIds ?? []), ...(observadorIds ?? [])]);
    if (criadorDisplay?.id) ids.add(criadorDisplay.id);
    if (projetoId) {
      for (const m of projetoMembros ?? []) ids.add(m.id);
    } else if (setorId) {
      for (const p of pessoasAtivas) {
        if (p.setor_id === setorId) ids.add(p.id);
      }
    }
    for (const c of comentarios) {
      if (c.usuario_id) ids.add(c.usuario_id);
    }
    return pessoasAtivas.filter((p) => ids.has(p.id));
  }, [
    atribuidoIds,
    observadorIds,
    criadorDisplay?.id,
    projetoId,
    projetoMembros,
    setorId,
    pessoasAtivas,
    comentarios,
  ]);

  const handleSave = form.handleSubmit(
    async (values) => {
      try {
        const payload = toPayload(values);
        if (isCreate) {
          const created = await createTarefa.mutateAsync(payload);
          toast.success("Tarefa criada");
          onSaved?.(created.id);
        } else if (tarefaId) {
          await updateTarefa.mutateAsync({ id: tarefaId, data: payload });
          toast.success("Tarefa atualizada");
          setEditingField(null);
        }
      } catch (error) {
        toast.error("Erro ao salvar tarefa", {
          description: getSupabaseErrorMessage(error as Error),
        });
      }
    },
    (errors) => {
      const messages = Object.values(errors)
        .map((error) =>
          error && typeof error === "object" && "message" in error
            ? String(error.message ?? "")
            : "",
        )
        .filter(Boolean);

      toast.error(isCreate ? "Não foi possível criar a tarefa" : "Não foi possível salvar a tarefa", {
        description:
          messages[0] ??
          "Preencha os campos obrigatórios (título e responsável) e tente novamente.",
      });

      if (errors.titulo) setEditingField("titulo");
    },
  );

  const handleAddSubtarefa = async () => {
    if (!tarefaId || !novaSubtarefa.trim()) return;
    try {
      await createSubtarefa.mutateAsync({ tarefaId, titulo: novaSubtarefa.trim() });
      setNovaSubtarefa("");
    } catch (error) {
      toast.error("Erro ao adicionar subtarefa", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  const saving = createTarefa.isPending || updateTarefa.isPending;
  const showInteractions = !isCreate && !!tarefaId;
  const {
    formState: { errors: formErrors },
  } = form;

  const startFieldEdit = (field: EditableTarefaField) => {
    if (!canEdit) return;
    setEditingField(field);
  };

  const endFieldEdit = () => setEditingField(null);

  return (
    <>
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && subtarefaDrawerId) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        className={LARGE_MODAL_CONTENT_CLASS}
        onInteractOutside={(event) => {
          if (subtarefaDrawerId) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (subtarefaDrawerId) event.preventDefault();
        }}
      >
        {isLoading && !isCreate ? (
          <div className="space-y-4 p-6">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
              <DialogHeader className="shrink-0 space-y-0 border-b px-6 py-4 pr-12 text-left">
                <div className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
                  <span>Projeto</span>
                  <ChevronRight className="h-3 w-3" />
                  <span>{selectedProjeto?.nome ?? "Nenhum"}</span>
                  <ChevronRight className="h-3 w-3" />
                  <span>Setor</span>
                  <ChevronRight className="h-3 w-3" />
                  <span>{selectedSetor?.nome ?? "Sem setor"}</span>
                  <ChevronRight className="h-3 w-3" />
                  <span className="font-medium text-foreground">
                    {isCreate ? "Nova tarefa" : tarefa?.titulo ?? "Tarefa"}
                  </span>
                </div>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <DialogTitle className="text-left">
                      {isCreate ? "Nova tarefa" : "Editar tarefa"}
                    </DialogTitle>
                    <DialogDescription className="text-left">
                      {isCreate
                        ? "Preencha o título, selecione ao menos um responsável pelos ícones e salve."
                        : "Clique nos ícones para alterar metadados. Duplo clique na descrição para editar."}
                    </DialogDescription>
                  </div>
                  {!readOnly && (
                    <div className="flex flex-wrap gap-2">
                      {tarefa && (
                        <>
                          <Badge
                            variant="outline"
                            className={TAREFA_PRIORIDADE_COLORS[tarefa.prioridade]}
                          >
                            {tarefa.prioridade}
                          </Badge>
                          <Badge
                            variant="secondary"
                            className={getTarefaConclusaoColorClass(tarefa.concluida)}
                          >
                            {getTarefaConclusaoLabel(tarefa.concluida)}
                          </Badge>
                        </>
                      )}
                      {canEdit && (
                        <Button
                          type="submit"
                          size="sm"
                          className="gap-2"
                          disabled={saving}
                          onClick={(event) => {
                            // Garante feedback mesmo se o submit nativo falhar silenciosamente.
                            if (event.currentTarget.form) return;
                            event.preventDefault();
                            void handleSave();
                          }}
                        >
                          <Save className="h-4 w-4" />
                          {saving ? "Salvando..." : isCreate ? "Criar tarefa" : "Salvar"}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </DialogHeader>

              <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                <ScrollArea className="min-h-0 flex-1">
                  <div className="space-y-4 p-6">
                    <TarefaMetaToolbar
                      form={form as never}
                      canEdit={canEdit}
                      canEditVisibility={canEditVisibility}
                      lockProjeto={lockProjeto}
                      projetos={projetos ?? []}
                      setores={setoresPermitidos}
                      pessoasParaResponsavel={pessoasParaResponsavel}
                      pessoasAtivas={pessoasAtivas}
                      emptyResponsavelLabel={
                        projetoId
                          ? "Defina a equipe do projeto antes de atribuir responsáveis"
                          : "Nenhuma pessoa disponível"
                      }
                    />

                    <TarefaPeopleStrip
                      criador={criadorDisplay}
                      createdAt={tarefa?.created_at ?? null}
                      responsaveis={responsaveisDisplay}
                      visibilidade={visibilidade}
                      visualizadores={visualizadoresDisplay}
                      setorNome={selectedSetor?.nome}
                      projetoNome={selectedProjeto?.nome}
                    />

                    {(formErrors.atribuido_ids ||
                      formErrors.visibilidade ||
                      formErrors.setor_id ||
                      formErrors.projeto_id ||
                      formErrors.observador_ids) && (
                      <div
                        role="alert"
                        className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                      >
                        {formErrors.atribuido_ids?.message ||
                          formErrors.observador_ids?.message ||
                          formErrors.setor_id?.message ||
                          formErrors.projeto_id?.message ||
                          formErrors.visibilidade?.message ||
                          "Verifique os campos obrigatórios dos metadados."}
                      </div>
                    )}

                    <FormField
                      control={form.control}
                      name="titulo"
                      render={({ field }) => (
                        <FormItem>
                          <EditableOnDoubleClick
                            locked={!canEdit}
                            forceEditable={isCreate}
                            editing={editingField === "titulo"}
                            onStartEdit={() => startFieldEdit("titulo")}
                            onEndEdit={endFieldEdit}
                          >
                            {(editable) => (
                              <FormControl>
                                <Input
                                  placeholder="Título da tarefa"
                                  className="rounded-xl border bg-card px-3 py-2 text-lg font-semibold shadow-sm focus-visible:ring-1"
                                  readOnly={!editable}
                                  disabled={!canEdit}
                                  {...field}
                                />
                              </FormControl>
                            )}
                          </EditableOnDoubleClick>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="descricao"
                      render={({ field }) => (
                        <FormItem>
                          <EditableOnDoubleClick
                            locked={!canEdit}
                            forceEditable={false}
                            editing={editingField === "descricao"}
                            onStartEdit={() => startFieldEdit("descricao")}
                            onEndEdit={endFieldEdit}
                          >
                            {(editable) => (
                              <FormControl>
                                <Textarea
                                  placeholder="Adicione uma descrição... (duplo clique para editar)"
                                  rows={4}
                                  className="rounded-xl border bg-card shadow-sm"
                                  readOnly={!editable}
                                  disabled={!canEdit}
                                  {...field}
                                />
                              </FormControl>
                            )}
                          </EditableOnDoubleClick>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <section>
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold">
                          Subtarefas{" "}
                          {subtarefas.length > 0 && `(${concluidas}/${subtarefas.length})`}
                        </h3>
                      </div>
                      {!showInteractions ? (
                        <p className="text-sm text-muted-foreground">
                          Salve a tarefa para adicionar subtarefas.
                        </p>
                      ) : (
                        <>
                          {canEdit && (
                            <div className="mb-3 flex gap-2">
                              <Input
                                placeholder="Nova subtarefa"
                                value={novaSubtarefa}
                                onChange={(e) => setNovaSubtarefa(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleAddSubtarefa();
                                  }
                                }}
                              />
                              <Button
                                type="button"
                                size="icon"
                                onClick={handleAddSubtarefa}
                                disabled={!novaSubtarefa.trim()}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                          <DndContext
                            sensors={subtarefaSensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleSubtarefaDragEnd}
                          >
                            <SortableContext
                              items={subtarefaOrder}
                              strategy={verticalListSortingStrategy}
                            >
                              <div className="space-y-2.5">
                                {orderedSubtarefas.map((sub) => (
                                  <SortableSubtarefaRow
                                    key={sub.id}
                                    subtarefa={sub}
                                    canEdit={canEdit}
                                    pessoasDisponiveis={pessoasMencionaveis}
                                    onOpen={() => setSubtarefaDrawerId(sub.id)}
                                    onToggle={async (concluida) => {
                                      applySubtarefaConclusaoOrder(sub.id, concluida);
                                      try {
                                        await toggleSubtarefa.mutateAsync({
                                          id: sub.id,
                                          concluida,
                                        });
                                      } catch (error) {
                                        setSubtarefaOrder(
                                          sortSubtarefasList(subtarefas).map((s) => s.id),
                                        );
                                        toast.error(getSupabaseErrorMessage(error as Error));
                                      }
                                    }}
                                    onUpdateMeta={async (meta) => {
                                      try {
                                        await updateSubtarefaMeta.mutateAsync({
                                          id: sub.id,
                                          data: meta,
                                        });
                                      } catch (error) {
                                        toast.error(getSupabaseErrorMessage(error as Error));
                                        throw error;
                                      }
                                    }}
                                    onDuplicate={async () => {
                                      try {
                                        await duplicateSubtarefa.mutateAsync(sub.id);
                                        toast.success("Subtarefa duplicada");
                                      } catch (error) {
                                        toast.error("Erro ao duplicar subtarefa", {
                                          description: getSupabaseErrorMessage(error as Error),
                                        });
                                      }
                                    }}
                                    onMove={() => setMovingSubtarefa(sub)}
                                    onDelete={async () => {
                                      try {
                                        await deleteSubtarefa.mutateAsync(sub.id);
                                      } catch (error) {
                                        toast.error(getSupabaseErrorMessage(error as Error));
                                        throw error;
                                      }
                                    }}
                                  />
                                ))}
                              </div>
                            </SortableContext>
                          </DndContext>
                        </>
                      )}
                    </section>
                  </div>
                </ScrollArea>

                <aside className="flex w-full shrink-0 flex-col border-t bg-muted/20 lg:w-96 lg:border-l lg:border-t-0">
                  <Tabs
                    value={sideTab}
                    onValueChange={(value) => setSideTab(value as "comentarios" | "anexos")}
                    className="flex min-h-0 flex-1 flex-col"
                  >
                    <TabsList className="mx-4 mt-4 grid w-auto grid-cols-2">
                      <TabsTrigger value="anexos" className="gap-1.5">
                        <Paperclip className="h-3.5 w-3.5" />
                        Anexos
                        {anexos.length > 0 && (
                          <span className="text-muted-foreground">({anexos.length})</span>
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="comentarios" className="gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5" />
                        Comentários
                        {comentarios.length > 0 && (
                          <span className="text-muted-foreground">({comentarios.length})</span>
                        )}
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent
                      value="anexos"
                      className="mt-0 min-h-0 flex-1 data-[state=inactive]:hidden"
                    >
                      <ScrollArea className="h-full max-h-[calc(90vh-10rem)] [&>[data-radix-scroll-area-viewport]>div]:!block">
                        <div className="w-full space-y-3 p-4">
                          {!showInteractions ? (
                            <p className="text-sm text-muted-foreground">
                              Salve a tarefa para adicionar anexos.
                            </p>
                          ) : (
                            <TarefaAnexosSection
                              tarefaId={tarefaId!}
                              anexos={anexos}
                              canEdit={canEdit}
                              canUpload={canCommentOrAttach}
                              hideTitle
                            />
                          )}
                        </div>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent
                      value="comentarios"
                      className="mt-0 min-h-0 flex-1 data-[state=inactive]:hidden"
                    >
                      <ScrollArea className="h-full max-h-[calc(90vh-10rem)]">
                        <div className="p-4">
                          {!showInteractions ? (
                            <p className="text-sm text-muted-foreground">
                              Salve a tarefa para adicionar comentários.
                            </p>
                          ) : (
                            <CommentsThread
                              comentarios={comentarios}
                              pessoasMencionaveis={pessoasMencionaveis}
                              currentUserId={profile?.id}
                              currentUserProfile={profile}
                              canComment={canCommentOrAttach}
                              highlightId={highlightComentarioId}
                              idPrefix="tarefa-comentario"
                              pending={createComentario.isPending}
                              onSubmit={async (conteudo, parentId) => {
                                try {
                                  await createComentario.mutateAsync({
                                    tarefaId: tarefaId!,
                                    conteudo,
                                    parentId,
                                  });
                                } catch (error) {
                                  toast.error("Erro ao comentar", {
                                    description: getSupabaseErrorMessage(error as Error),
                                  });
                                  throw error;
                                }
                              }}
                              onDelete={async (id) => {
                                try {
                                  await deleteComentario.mutateAsync(id);
                                } catch (error) {
                                  toast.error(getSupabaseErrorMessage(error as Error));
                                  throw error;
                                }
                              }}
                              onEdit={async (id, conteudo) => {
                                try {
                                  await updateComentario.mutateAsync({ id, conteudo });
                                } catch (error) {
                                  toast.error("Erro ao editar comentário", {
                                    description: getSupabaseErrorMessage(error as Error),
                                  });
                                  throw error;
                                }
                              }}
                            />
                          )}
                        </div>
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>
                </aside>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>

    <SubtarefaPanelSheet
      subtarefaId={subtarefaDrawerId}
      open={!!subtarefaDrawerId}
      onOpenChange={(next) => {
        if (!next) setSubtarefaDrawerId(null);
      }}
      parentTarefa={tarefa ?? null}
      readOnly={readOnly}
      initialAba={initialSubtarefaId && subtarefaDrawerId === initialSubtarefaId ? initialAba : undefined}
      highlightComentarioId={
        initialSubtarefaId && subtarefaDrawerId === initialSubtarefaId
          ? highlightComentarioId
          : null
      }
    />

    <MoverSubtarefaDialog
      subtarefa={movingSubtarefa}
      open={!!movingSubtarefa}
      onOpenChange={(open) => {
        if (!open) setMovingSubtarefa(null);
      }}
    />
    </>
  );
}
