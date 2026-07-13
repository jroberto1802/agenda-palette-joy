import { ProfileAvatar } from "@/components/common/profile-avatar";
import { EditableSurface } from "@/components/common/editable-surface";
import { TarefaAnexosSection } from "@/components/tarefas/tarefa-anexos-section";
import {
  draftToFormData,
  TarefaSubtarefasSection,
  type DraftSubtarefa,
} from "@/components/tarefas/tarefa-subtarefas-section";
import {
  TarefaRecorrenciaFields,
  type RecorrenciaFormValues,
} from "@/components/tarefas/tarefa-recorrencia-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { PessoasMultiSelect } from "@/components/common/pessoas-multi-select";
import { usePessoas } from "@/hooks/use-pessoas";
import { useProjetos } from "@/hooks/use-projetos";
import { useProfile } from "@/hooks/use-profile";
import { LARGE_MODAL_CONTENT_CLASS } from "@/lib/layout";
import { useSetores } from "@/hooks/use-setores";
import { listProjetoMembros } from "@/services/projetos";
import { useQuery } from "@tanstack/react-query";
import {
  useCreateTarefa,
  useCreateTarefaComentario,
  useDeleteTarefaComentario,
  useTarefaDetail,
  useUpdateTarefa,
} from "@/hooks/use-tarefas";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import { cn } from "@/lib/utils";
import type {
  RecorrenciaConfig,
  RecorrenciaTipo,
  TarefaFormData,
  TarefaLembreteOpcao,
  TarefaPrioridade,
  TarefaStatus,
  TarefaVisibilidade,
  TarefaWithRelations,
} from "@/types";
import { formatDateTime } from "@/utils/formatters";
import { formatRecorrencia, parseRecorrencia } from "@/utils/recorrencia";
import { isAdmin, isGerente } from "@/utils/permissions";
import {
  TAREFA_LEMBRETE_LABELS,
  TAREFA_PRIORIDADE_COLORS,
  TAREFA_PRIORIDADE_LABELS,
  TAREFA_STATUS_COLORS,
  TAREFA_STATUS_LABELS,
  TAREFA_VISIBILIDADE_LABELS,
  canEditTarefa,
  canEditVisibilidade,
  getSetoresPermitidos,
  parseLembretes,
} from "@/utils/tarefas";
import type { UseFormReturn } from "react-hook-form";
import { Bell, CalendarIcon, ChevronRight, MessageSquare, Paperclip, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
const tarefaPanelSchema = z
  .object({
    titulo: z.string().min(2, "Título deve ter pelo menos 2 caracteres"),
    descricao: z.string(),
    projeto_id: z.string().nullable(),
    setor_id: z.string().nullable(),
    atribuido_ids: z.array(z.string()).min(1, "Selecione ao menos um responsável"),
    prioridade: z.enum(["P1", "P2", "P3", "P4"]),
    status: z.enum(["a_fazer", "em_andamento", "bloqueada", "concluida"]),
    data_inicio: z.date().nullable(),
    data_vencimento: z.date().nullable(),
    tagsInput: z.string(),
    visibilidade: z.enum([
      "todos_empresa",
      "todos_setor",
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
    if (data.visibilidade === "pessoas_especificas" && data.observador_ids.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecione ao menos uma pessoa.",
        path: ["observador_ids"],
      });
    }
  });

type TarefaPanelSchema = z.infer<typeof tarefaPanelSchema>;

function parseTags(input: string): string[] {
  return input
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function defaultVisibilidade(setorId?: string | null): TarefaVisibilidade {
  return setorId ? "todos_setor" : "todos_empresa";
}

function toFormValues(
  tarefa?: TarefaWithRelations | null,
  defaultSetorId?: string | null,
  defaultResponsavelId?: string | null,
  defaultProjetoId?: string | null,
): TarefaPanelSchema {
  const rec = parseRecorrencia(tarefa?.recorrencia);
  const atribuidoIds =
    tarefa?.responsaveis?.map((r) => r.usuario_id) ??
    (tarefa?.atribuido_a ? [tarefa.atribuido_a] : defaultResponsavelId ? [defaultResponsavelId] : []);

  return {
    titulo: tarefa?.titulo ?? "",
    descricao: tarefa?.descricao ?? "",
    projeto_id: tarefa?.projeto_id ?? defaultProjetoId ?? null,
    setor_id: tarefa?.setor_id ?? defaultSetorId ?? null,
    atribuido_ids: atribuidoIds,
    prioridade: tarefa?.prioridade ?? "P4",
    status: tarefa?.status ?? "a_fazer",
    data_inicio: tarefa?.data_inicio ? new Date(tarefa.data_inicio) : null,
    data_vencimento: tarefa?.data_vencimento ? new Date(tarefa.data_vencimento) : null,
    tagsInput: tarefa?.tags?.join(", ") ?? "",
    visibilidade: tarefa?.visibilidade ?? defaultVisibilidade(defaultSetorId),
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
    status: values.status,
    data_inicio: values.data_inicio ? values.data_inicio.toISOString() : null,
    data_vencimento: values.data_vencimento ? values.data_vencimento.toISOString() : null,
    tags: parseTags(values.tagsInput),
    recorrencia: toRecorrenciaPayload(values),
    visibilidade: values.visibilidade,
    observador_ids: values.observador_ids,
    lembretes: values.lembretes,
  };
}

function DateField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start pl-3 text-left font-normal",
              !value && "text-muted-foreground",
            )}
          >
            {value ? format(value, "dd/MM/yyyy", { locale: ptBR }) : "Sem data"}
            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value ?? undefined}
            onSelect={(date) => onChange(date ?? null)}
            locale={ptBR}
            initialFocus
          />
          {value && (
            <div className="p-2 border-t">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => onChange(null)}
              >
                Remover data
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function MetaChip({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 max-w-full items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs",
        className,
      )}
    >
      <span className="shrink-0 font-medium text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function PersonRow({
  label,
  name,
  avatarUrl,
}: {
  label: string;
  name: string;
  avatarUrl?: string | null;
}) {
  return (
    <MetaChip label={label}>
      <span className="flex items-center gap-1.5">
        <ProfileAvatar name={name} avatarUrl={avatarUrl} className="h-5 w-5" />
        <span className="truncate font-medium text-foreground">{name}</span>
      </span>
    </MetaChip>
  );
}

export function TarefaPanelSheet({
  tarefaId,
  open,
  onOpenChange,
  readOnly = false,
  onSaved,
  defaultProjetoId = null,
  lockProjeto = false,
  initialAba,
  highlightComentarioId = null,
}: {
  tarefaId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readOnly?: boolean;
  onSaved?: (tarefaId: string) => void;
  defaultProjetoId?: string | null;
  lockProjeto?: boolean;
  initialAba?: "comentarios" | "anexos";
  highlightComentarioId?: string | null;
}) {
  const isCreate = !tarefaId;
  const { data: profile } = useProfile();
  const { data: setores } = useSetores();
  const { data: projetos } = useProjetos();
  const { data: pessoas } = usePessoas();
  const { data: tarefa, isLoading } = useTarefaDetail(tarefaId);

  const createTarefa = useCreateTarefa();
  const updateTarefa = useUpdateTarefa();
  const createComentario = useCreateTarefaComentario();
  const deleteComentario = useDeleteTarefaComentario();

  const [draftSubtarefas, setDraftSubtarefas] = useState<DraftSubtarefa[]>([]);
  const [novoComentario, setNovoComentario] = useState("");
  const [sideTab, setSideTab] = useState<"comentarios" | "anexos">(
    initialAba ?? "comentarios",
  );

  useEffect(() => {
    if (!open) return;
    setSideTab(initialAba ?? "comentarios");
  }, [open, initialAba, tarefaId]);

  useEffect(() => {
    if (!open || !highlightComentarioId) return;
    setSideTab("comentarios");
    const timer = window.setTimeout(() => {
      document
        .getElementById(`tarefa-comentario-${highlightComentarioId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [open, highlightComentarioId, tarefa?.comentarios]);

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
    defaultValues: toFormValues(null, profile?.setor_id, profile?.id, defaultProjetoId),
  });

  const visibilidade = form.watch("visibilidade");
  const projetoId = form.watch("projeto_id");
  const setorId = form.watch("setor_id");
  const atribuidoIds = form.watch("atribuido_ids");
  const observadorIds = form.watch("observador_ids");
  const tituloValue = form.watch("titulo");
  const descricaoValue = form.watch("descricao");
  const prioridadeValue = form.watch("prioridade");
  const statusValue = form.watch("status");
  const dataInicioValue = form.watch("data_inicio");
  const dataVencimentoValue = form.watch("data_vencimento");
  const tagsInputValue = form.watch("tagsInput");
  const lembretesValue = form.watch("lembretes");
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

  useEffect(() => {
    if (!open) return;
    form.reset(toFormValues(tarefa ?? null, profile?.setor_id, undefined, defaultProjetoId));
    setDraftSubtarefas([]);
    setNovoComentario("");
  }, [open, tarefa, profile?.setor_id, defaultProjetoId, form]);

  useEffect(() => {
    if (!open || !!tarefa || !isCreate) return;
    const currentProjetoId = form.getValues("projeto_id");
    if (!currentProjetoId) {
      if (profile?.id) form.setValue("atribuido_ids", [profile.id]);
      return;
    }
    if (!projetoMembros) return;
    if (profile?.id && projetoMembros.some((m) => m.id === profile.id)) {
      form.setValue("atribuido_ids", [profile.id]);
    } else {
      form.setValue("atribuido_ids", []);
    }
  }, [open, tarefa, isCreate, projetoMembros, profile?.id, form]);

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
    return pessoasParaResponsavel.filter((p) => (atribuidoIds ?? []).includes(p.id));
  }, [atribuidoIds, pessoasParaResponsavel]);

  const subtarefas = tarefa?.subtarefas ?? [];
  const comentarios = tarefa?.comentarios ?? [];
  const anexos = tarefa?.anexos ?? [];
  const recorrencia = tarefa ? parseRecorrencia(tarefa.recorrencia) : null;

  const pessoasComAcesso = useMemo(() => {
    const ids = new Set<string>([...(atribuidoIds ?? []), ...(observadorIds ?? [])]);
    if (criadorDisplay?.id) ids.add(criadorDisplay.id);
    return pessoasAtivas.filter((p) => ids.has(p.id));
  }, [atribuidoIds, observadorIds, criadorDisplay?.id, pessoasAtivas]);

  const handleSave = form.handleSubmit(async (values) => {
    try {
      const payload = toPayload(values);
      if (isCreate) {
        payload.subtarefas = draftToFormData(draftSubtarefas);
        const created = await createTarefa.mutateAsync(payload);
        toast.success("Tarefa criada");
        onSaved?.(created.id);
      } else if (tarefaId) {
        await updateTarefa.mutateAsync({ id: tarefaId, data: payload });
        toast.success("Tarefa atualizada");
      }
    } catch (error) {
      toast.error("Erro ao salvar tarefa", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  });

  const handleAddComentario = async () => {
    if (!tarefaId || !novoComentario.trim()) return;
    try {
      await createComentario.mutateAsync({ tarefaId, conteudo: novoComentario.trim() });
      setNovoComentario("");
    } catch (error) {
      toast.error("Erro ao comentar", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  };

  const toggleLembrete = (opcao: TarefaLembreteOpcao, checked: boolean) => {
    const current = form.getValues("lembretes");
    form.setValue(
      "lembretes",
      checked ? [...current, opcao] : current.filter((item) => item !== opcao),
      { shouldValidate: true },
    );
  };

  const saving = createTarefa.isPending || updateTarefa.isPending;
  const showInteractions = !isCreate && !!tarefaId;
  const forceFieldEdit = isCreate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={LARGE_MODAL_CONTENT_CLASS}>
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
                      {isCreate ? "Nova tarefa" : "Detalhes da tarefa"}
                    </DialogTitle>
                    <DialogDescription className="text-left">
                      {isCreate
                        ? "Preencha os campos e salve para criar a tarefa."
                        : "Visualize e edite os dados da tarefa."}
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
                          <Badge variant="secondary" className={TAREFA_STATUS_COLORS[tarefa.status]}>
                            {TAREFA_STATUS_LABELS[tarefa.status]}
                          </Badge>
                        </>
                      )}
                      {canEdit && (
                        <Button type="submit" size="sm" className="gap-2" disabled={saving}>
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
                  <div className="space-y-6 p-6">
                    <FormField
                      control={form.control}
                      name="titulo"
                      render={({ field }) => (
                        <FormItem>
                          <EditableSurface
                            canEdit={canEdit}
                            forceEdit={forceFieldEdit}
                            display={
                              <p className="text-lg font-semibold leading-snug">
                                {tituloValue || "Sem título"}
                              </p>
                            }
                          >
                            <FormControl>
                              <Input
                                placeholder="Título da tarefa"
                                className="border-0 px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
                                {...field}
                              />
                            </FormControl>
                          </EditableSurface>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex flex-wrap items-center gap-2">
                      <FormField
                        control={form.control}
                        name="projeto_id"
                        render={({ field }) => (
                          <FormItem className="space-y-0">
                            <EditableSurface
                              canEdit={canEdit && !lockProjeto}
                              forceEdit={forceFieldEdit}
                              display={
                                <MetaChip label="Projeto">
                                  <span className="font-medium text-foreground">
                                    {selectedProjeto?.nome ?? "Nenhum"}
                                  </span>
                                </MetaChip>
                              }
                            >
                              <MetaChip label="Projeto">
                                <Select
                                  value={field.value ?? "none"}
                                  onValueChange={(v) => {
                                    const next = v === "none" ? null : v;
                                    field.onChange(next);
                                    if (next) form.setValue("atribuido_ids", []);
                                  }}
                                  disabled={lockProjeto}
                                >
                                  <FormControl>
                                    <SelectTrigger className="h-auto border-0 bg-transparent p-0 shadow-none focus:ring-0 [&>svg]:h-3.5 [&>svg]:w-3.5">
                                      <SelectValue placeholder="Nenhum" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="none">Nenhum</SelectItem>
                                    {(projetos ?? []).map((projeto) => (
                                      <SelectItem key={projeto.id} value={projeto.id}>
                                        {projeto.nome}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </MetaChip>
                            </EditableSurface>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="setor_id"
                        render={({ field }) => (
                          <FormItem className="space-y-0">
                            <EditableSurface
                              canEdit={canEdit}
                              forceEdit={forceFieldEdit}
                              display={
                                <MetaChip label="Setor">
                                  <span className="font-medium text-foreground">
                                    {selectedSetor?.nome ?? "Nenhum"}
                                  </span>
                                </MetaChip>
                              }
                            >
                              <MetaChip label="Setor">
                                <Select
                                  value={field.value ?? "none"}
                                  onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                                >
                                  <FormControl>
                                    <SelectTrigger className="h-auto border-0 bg-transparent p-0 shadow-none focus:ring-0 [&>svg]:h-3.5 [&>svg]:w-3.5">
                                      <SelectValue placeholder="Nenhum" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="none">Nenhum</SelectItem>
                                    {setoresPermitidos.map((s) => (
                                      <SelectItem key={s.id} value={s.id}>
                                        {s.nome}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </MetaChip>
                            </EditableSurface>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {criadorDisplay && (
                        <PersonRow
                          label="Criado por"
                          name={criadorDisplay.nome_completo}
                          avatarUrl={criadorDisplay.avatar_url}
                        />
                      )}

                      <FormField
                        control={form.control}
                        name="atribuido_ids"
                        render={({ field }) => (
                          <FormItem className="space-y-0">
                            <EditableSurface
                              canEdit={canEdit}
                              forceEdit={forceFieldEdit}
                              display={
                                <MetaChip label="Responsáveis" className="max-w-full">
                                  {responsaveisDisplay.length === 0 ? (
                                    <span className="font-medium text-foreground">Nenhum</span>
                                  ) : (
                                    <div className="flex -space-x-1.5">
                                      {responsaveisDisplay.map((p) => (
                                        <ProfileAvatar
                                          key={p.id}
                                          name={p.nome_completo}
                                          avatarUrl={p.avatar_url}
                                          className="h-5 w-5 ring-2 ring-background"
                                        />
                                      ))}
                                    </div>
                                  )}
                                </MetaChip>
                              }
                            >
                              <MetaChip label="Responsáveis" className="max-w-full">
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button
                                      type="button"
                                      className="flex max-w-[220px] items-center gap-1 truncate text-left font-medium text-foreground"
                                    >
                                      {responsaveisDisplay.length === 0
                                        ? "Nenhum"
                                        : responsaveisDisplay.length === 1
                                          ? responsaveisDisplay[0].nome_completo
                                          : `${responsaveisDisplay.length} pessoas`}
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-80 p-3" align="start">
                                    <PessoasMultiSelect
                                      pessoas={pessoasParaResponsavel}
                                      value={field.value}
                                      onChange={field.onChange}
                                      disabled={!canEdit}
                                      placeholder="Selecione responsáveis"
                                      emptyLabel={
                                        projetoId
                                          ? "Defina a equipe do projeto antes de atribuir responsáveis"
                                          : "Nenhuma pessoa disponível"
                                      }
                                    />
                                  </PopoverContent>
                                </Popover>
                              </MetaChip>
                            </EditableSurface>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="data_inicio"
                        render={({ field }) => (
                          <FormItem className="space-y-0">
                            <EditableSurface
                              canEdit={canEdit}
                              forceEdit={forceFieldEdit}
                              display={
                                <MetaChip label="Data">
                                  <span className="font-medium text-foreground">
                                    {dataInicioValue
                                      ? format(dataInicioValue, "dd/MM/yyyy", { locale: ptBR })
                                      : "Sem data"}
                                  </span>
                                </MetaChip>
                              }
                            >
                              <MetaChip label="Data">
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button type="button" className="font-medium text-foreground">
                                      {field.value
                                        ? format(field.value, "dd/MM/yyyy", { locale: ptBR })
                                        : "Sem data"}
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                      mode="single"
                                      selected={field.value ?? undefined}
                                      onSelect={field.onChange}
                                      locale={ptBR}
                                      initialFocus
                                    />
                                    {field.value && (
                                      <div className="border-t p-2">
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          className="w-full"
                                          onClick={() => field.onChange(null)}
                                        >
                                          Remover data
                                        </Button>
                                      </div>
                                    )}
                                  </PopoverContent>
                                </Popover>
                              </MetaChip>
                            </EditableSurface>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="descricao"
                      render={({ field }) => (
                        <FormItem>
                          <EditableSurface
                            canEdit={canEdit}
                            forceEdit={forceFieldEdit}
                            display={
                              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                                {descricaoValue?.trim() || "Sem descrição"}
                              </p>
                            }
                          >
                            <FormControl>
                              <Textarea
                                placeholder="Adicione uma descrição..."
                                rows={4}
                                {...field}
                              />
                            </FormControl>
                          </EditableSurface>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <TarefaSubtarefasSection
                      tarefaId={tarefaId}
                      subtarefas={subtarefas}
                      canEdit={canEdit}
                      isCreate={isCreate}
                      pessoas={pessoasParaResponsavel}
                      profile={profile}
                      drafts={draftSubtarefas}
                      onDraftsChange={setDraftSubtarefas}
                    />

                    <Separator />

                    <section className="space-y-5">
                      <h3 className="text-sm font-semibold">Detalhes da tarefa</h3>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="data_vencimento"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Prazo</FormLabel>
                              <EditableSurface
                                canEdit={canEdit}
                                forceEdit={forceFieldEdit}
                                display={
                                  <p className="text-sm">
                                    {dataVencimentoValue
                                      ? format(dataVencimentoValue, "dd/MM/yyyy", { locale: ptBR })
                                      : "Sem prazo"}
                                  </p>
                                }
                              >
                                <DateField
                                  label=""
                                  value={field.value}
                                  onChange={field.onChange}
                                />
                              </EditableSurface>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="prioridade"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Prioridade</FormLabel>
                              <EditableSurface
                                canEdit={canEdit}
                                forceEdit={forceFieldEdit}
                                display={
                                  <Badge
                                    variant="outline"
                                    className={TAREFA_PRIORIDADE_COLORS[prioridadeValue]}
                                  >
                                    {TAREFA_PRIORIDADE_LABELS[prioridadeValue]}
                                  </Badge>
                                }
                              >
                                <Select
                                  value={field.value}
                                  onValueChange={(v) => field.onChange(v as TarefaPrioridade)}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {(Object.keys(TAREFA_PRIORIDADE_LABELS) as TarefaPrioridade[]).map(
                                      (p) => (
                                        <SelectItem key={p} value={p}>
                                          {TAREFA_PRIORIDADE_LABELS[p]}
                                        </SelectItem>
                                      ),
                                    )}
                                  </SelectContent>
                                </Select>
                              </EditableSurface>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Status</FormLabel>
                              <EditableSurface
                                canEdit={canEdit}
                                forceEdit={forceFieldEdit}
                                display={
                                  <Badge
                                    variant="secondary"
                                    className={TAREFA_STATUS_COLORS[statusValue]}
                                  >
                                    {TAREFA_STATUS_LABELS[statusValue]}
                                  </Badge>
                                }
                              >
                                <Select
                                  value={field.value}
                                  onValueChange={(v) => field.onChange(v as TarefaStatus)}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {(Object.keys(TAREFA_STATUS_LABELS) as TarefaStatus[]).map((s) => (
                                      <SelectItem key={s} value={s}>
                                        {TAREFA_STATUS_LABELS[s]}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </EditableSurface>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="tagsInput"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Etiquetas</FormLabel>
                              <EditableSurface
                                canEdit={canEdit}
                                forceEdit={forceFieldEdit}
                                display={
                                  <p className="text-sm text-muted-foreground">
                                    {tagsInputValue.trim() || "Nenhuma"}
                                  </p>
                                }
                              >
                                <FormControl>
                                  <Input placeholder="urgente, cliente-x" {...field} />
                                </FormControl>
                              </EditableSurface>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="visibilidade"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Visibilidade</FormLabel>
                              <EditableSurface
                                canEdit={canEditVisibility}
                                forceEdit={forceFieldEdit}
                                display={
                                  <p className="text-sm">
                                    {TAREFA_VISIBILIDADE_LABELS[visibilidade]}
                                  </p>
                                }
                              >
                                <Select
                                  value={field.value}
                                  onValueChange={(v) => field.onChange(v as TarefaVisibilidade)}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {(
                                      Object.keys(TAREFA_VISIBILIDADE_LABELS) as TarefaVisibilidade[]
                                    ).map((v) => (
                                      <SelectItem key={v} value={v}>
                                        {TAREFA_VISIBILIDADE_LABELS[v]}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </EditableSurface>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="lembretes"
                          render={({ field }) => (
                            <FormItem className="sm:col-span-2">
                              <FormLabel className="flex items-center gap-2">
                                <Bell className="h-4 w-4" />
                                Lembretes
                              </FormLabel>
                              <EditableSurface
                                canEdit={canEdit}
                                forceEdit={forceFieldEdit}
                                display={
                                  <p className="text-sm text-muted-foreground">
                                    {lembretesValue.length === 0
                                      ? "Nenhum lembrete"
                                      : lembretesValue
                                          .map((l) => TAREFA_LEMBRETE_LABELS[l])
                                          .join(", ")}
                                  </p>
                                }
                              >
                                <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
                                  {(Object.keys(TAREFA_LEMBRETE_LABELS) as TarefaLembreteOpcao[]).map(
                                    (opcao) => (
                                      <label key={opcao} className="flex items-center gap-2 text-sm">
                                        <Checkbox
                                          checked={field.value.includes(opcao)}
                                          onCheckedChange={(checked) =>
                                            toggleLembrete(opcao, !!checked)
                                          }
                                        />
                                        {TAREFA_LEMBRETE_LABELS[opcao]}
                                      </label>
                                    ),
                                  )}
                                </div>
                              </EditableSurface>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {(visibilidade === "pessoas_especificas" ||
                        (atribuidoIds?.length ?? 0) > 0) && (
                        <FormField
                          control={form.control}
                          name="observador_ids"
                          render={({ field }) => (
                              <FormItem>
                                <FormLabel>Pessoas com acesso</FormLabel>
                                <EditableSurface
                                  canEdit={
                                    canEditVisibility && visibilidade === "pessoas_especificas"
                                  }
                                  forceEdit={
                                    forceFieldEdit && visibilidade === "pessoas_especificas"
                                  }
                                  display={
                                    <TooltipProvider delayDuration={200}>
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        {pessoasComAcesso.length === 0 ? (
                                          <span className="text-sm text-muted-foreground">
                                            Nenhuma pessoa
                                          </span>
                                        ) : (
                                          pessoasComAcesso.map((p) => (
                                            <Tooltip key={p.id}>
                                              <TooltipTrigger asChild>
                                                <span>
                                                  <ProfileAvatar
                                                    name={p.nome_completo}
                                                    avatarUrl={p.avatar_url}
                                                    className="h-8 w-8"
                                                  />
                                                </span>
                                              </TooltipTrigger>
                                              <TooltipContent>{p.nome_completo}</TooltipContent>
                                            </Tooltip>
                                          ))
                                        )}
                                      </div>
                                    </TooltipProvider>
                                  }
                                >
                                  {visibilidade === "pessoas_especificas" ? (
                                    <PessoasMultiSelect
                                      pessoas={pessoasAtivas}
                                      value={field.value}
                                      onChange={field.onChange}
                                      placeholder="Selecione pessoas com acesso"
                                      emptyLabel="Nenhuma pessoa disponível"
                                    />
                                  ) : (
                                    <TooltipProvider delayDuration={200}>
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        {pessoasComAcesso.map((p) => (
                                          <Tooltip key={p.id}>
                                            <TooltipTrigger asChild>
                                              <span>
                                                <ProfileAvatar
                                                  name={p.nome_completo}
                                                  avatarUrl={p.avatar_url}
                                                  className="h-8 w-8"
                                                />
                                              </span>
                                            </TooltipTrigger>
                                            <TooltipContent>{p.nome_completo}</TooltipContent>
                                          </Tooltip>
                                        ))}
                                      </div>
                                    </TooltipProvider>
                                  )}
                                </EditableSurface>
                                <FormMessage />
                              </FormItem>
                            )}
                        />
                      )}

                      {canEdit && (
                        <TarefaRecorrenciaFields
                          form={form as unknown as UseFormReturn<RecorrenciaFormValues>}
                        />
                      )}

                      {!canEdit && recorrencia && (
                        <div className="text-xs text-muted-foreground">
                          Recorrência: {formatRecorrencia(recorrencia)}
                        </div>
                      )}
                    </section>
                  </div>
                </ScrollArea>

                <aside className="flex w-full shrink-0 flex-col border-t bg-muted/20 lg:w-96 lg:border-l lg:border-t-0">
                  <Tabs
                    value={sideTab}
                    onValueChange={(value) => setSideTab(value as "comentarios" | "anexos")}
                    className="flex min-h-0 flex-1 flex-col"
                  >                    <TabsList className="mx-4 mt-4 grid w-auto grid-cols-2">
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
                      <ScrollArea className="h-full max-h-[calc(90vh-10rem)]">
                        <div className="space-y-3 p-4">
                          {!showInteractions ? (
                            <p className="text-sm text-muted-foreground">
                              Salve a tarefa para adicionar anexos.
                            </p>
                          ) : (
                            <TarefaAnexosSection
                              tarefaId={tarefaId!}
                              anexos={anexos}
                              canEdit={canEdit}
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
                        <div className="space-y-4 p-4">
                          {!showInteractions ? (
                            <p className="text-sm text-muted-foreground">
                              Salve a tarefa para adicionar comentários.
                            </p>
                          ) : (
                            <>
                              <div className="space-y-4">
                                {comentarios.length === 0 && (
                                  <p className="text-sm text-muted-foreground">
                                    Nenhum comentário ainda.
                                  </p>
                                )}
                                {comentarios.map((c) => (
                                  <div
                                    key={c.id}
                                    id={`tarefa-comentario-${c.id}`}
                                    className={cn(
                                      "group flex gap-3 rounded-lg p-2 transition-colors",
                                      highlightComentarioId === c.id &&
                                        "bg-primary/10 ring-1 ring-primary/40",
                                    )}
                                  >                                    <ProfileAvatar
                                      name={c.usuario?.nome_completo ?? "?"}
                                      avatarUrl={c.usuario?.avatar_url}
                                      className="h-8 w-8 shrink-0"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium">
                                          {c.usuario?.nome_completo}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {formatDateTime(c.created_at)}
                                        </p>
                                        {c.usuario_id === profile?.id && (
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="ml-auto h-6 w-6 opacity-0 group-hover:opacity-100"
                                            onClick={async () => {
                                              try {
                                                await deleteComentario.mutateAsync(c.id);
                                              } catch (error) {
                                                toast.error(
                                                  getSupabaseErrorMessage(error as Error),
                                                );
                                              }
                                            }}
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        )}
                                      </div>
                                      <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">
                                        {c.conteudo}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {canEdit && (
                                <div className="space-y-2 border-t pt-3">
                                  <Textarea
                                    placeholder="Escreva um comentário..."
                                    rows={3}
                                    value={novoComentario}
                                    onChange={(e) => setNovoComentario(e.target.value)}
                                  />
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={handleAddComentario}
                                    disabled={!novoComentario.trim() || createComentario.isPending}
                                  >
                                    Comentar
                                  </Button>
                                </div>
                              )}
                            </>
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
  );
}
