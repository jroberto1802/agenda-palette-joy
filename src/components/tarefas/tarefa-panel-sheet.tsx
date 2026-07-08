import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bell, CalendarIcon, ChevronRight, MessageSquare, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ProfileAvatar } from "@/components/common/profile-avatar";
import { TarefaAnexosSection } from "@/components/tarefas/tarefa-anexos-section";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { usePessoas } from "@/hooks/use-pessoas";
import { useProfile } from "@/hooks/use-profile";
import { useSetores } from "@/hooks/use-setores";
import {
  useCreateSubtarefa,
  useCreateTarefa,
  useCreateTarefaComentario,
  useDeleteSubtarefa,
  useDeleteTarefaComentario,
  useTarefaDetail,
  useToggleSubtarefa,
  useUpdateTarefa,
} from "@/hooks/use-tarefas";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import { cn } from "@/lib/utils";
import type {
  ProfileWithSetor,
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

const tarefaPanelSchema = z
  .object({
    titulo: z.string().min(2, "Título deve ter pelo menos 2 caracteres"),
    descricao: z.string(),
    setor_id: z.string().nullable(),
    atribuido_a: z.string().nullable(),
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
): TarefaPanelSchema {
  const rec = parseRecorrencia(tarefa?.recorrencia);
  return {
    titulo: tarefa?.titulo ?? "",
    descricao: tarefa?.descricao ?? "",
    setor_id: tarefa?.setor_id ?? defaultSetorId ?? null,
    atribuido_a: tarefa?.atribuido_a ?? null,
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
    setor_id: values.setor_id,
    atribuido_a: values.atribuido_a,
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
            onSelect={onChange}
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
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2 rounded-md border px-3 py-2">
        <ProfileAvatar name={name} avatarUrl={avatarUrl} className="h-8 w-8 shrink-0" />
        <span className="text-sm font-medium truncate">{name}</span>
      </div>
    </div>
  );
}

export function TarefaPanelSheet({
  tarefaId,
  open,
  onOpenChange,
  readOnly = false,
  onSaved,
}: {
  tarefaId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readOnly?: boolean;
  onSaved?: (tarefaId: string) => void;
}) {
  const isCreate = !tarefaId;
  const { data: profile } = useProfile();
  const { data: setores } = useSetores();
  const { data: pessoas } = usePessoas();
  const { data: tarefa, isLoading } = useTarefaDetail(tarefaId);

  const createTarefa = useCreateTarefa();
  const updateTarefa = useUpdateTarefa();
  const createSubtarefa = useCreateSubtarefa();
  const toggleSubtarefa = useToggleSubtarefa();
  const deleteSubtarefa = useDeleteSubtarefa();
  const createComentario = useCreateTarefaComentario();
  const deleteComentario = useDeleteTarefaComentario();

  const [novaSubtarefa, setNovaSubtarefa] = useState("");
  const [novoComentario, setNovoComentario] = useState("");

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
    defaultValues: toFormValues(null, profile?.setor_id),
  });

  const visibilidade = form.watch("visibilidade");
  const setorId = form.watch("setor_id");
  const atribuidoId = form.watch("atribuido_a");
  const selectedSetor = setores?.find((s) => s.id === setorId);

  useEffect(() => {
    if (!open) return;
    form.reset(toFormValues(tarefa ?? null, profile?.setor_id));
    setNovaSubtarefa("");
    setNovoComentario("");
  }, [open, tarefa, profile?.setor_id, form]);

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

  const responsavelDisplay = useMemo(() => {
    if (!atribuidoId) return null;
    return (
      pessoasAtivas.find((p) => p.id === atribuidoId) ??
      tarefa?.responsavel ??
      null
    );
  }, [atribuidoId, pessoasAtivas, tarefa]);

  const subtarefas = tarefa?.subtarefas ?? [];
  const comentarios = tarefa?.comentarios ?? [];
  const anexos = tarefa?.anexos ?? [];
  const concluidas = subtarefas.filter((s) => s.concluida).length;
  const recorrencia = tarefa ? parseRecorrencia(tarefa.recorrencia) : null;

  const handleSave = form.handleSubmit(async (values) => {
    try {
      const payload = toPayload(values);
      if (isCreate) {
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

  const toggleObservador = (pessoaId: string, checked: boolean) => {
    const current = form.getValues("observador_ids");
    form.setValue(
      "observador_ids",
      checked ? [...current, pessoaId] : current.filter((id) => id !== pessoaId),
      { shouldValidate: true },
    );
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-5xl p-0 flex flex-col gap-0">
        {isLoading && !isCreate ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0">
              <SheetHeader className="px-6 py-4 border-b shrink-0">
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                  <span>Projeto</span>
                  <ChevronRight className="h-3 w-3" />
                  <span>{selectedSetor?.nome ?? "Sem setor"}</span>
                  <ChevronRight className="h-3 w-3" />
                  <span className="text-foreground font-medium">
                    {isCreate ? "Nova tarefa" : tarefa?.titulo ?? "Tarefa"}
                  </span>
                </div>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <SheetTitle className="text-left">
                      {isCreate ? "Nova tarefa" : "Detalhes da tarefa"}
                    </SheetTitle>
                    <SheetDescription className="text-left">
                      {isCreate
                        ? "Preencha os campos e salve para criar a tarefa."
                        : "Visualize e edite os dados da tarefa."}
                    </SheetDescription>
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
              </SheetHeader>

              <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
                <ScrollArea className="flex-1 min-h-0">
                  <div className="p-6 space-y-6">
                    <FormField
                      control={form.control}
                      name="titulo"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              placeholder="Título da tarefa"
                              className="text-lg font-semibold border-0 px-0 shadow-none focus-visible:ring-0"
                              disabled={!canEdit}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="descricao"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Textarea
                              placeholder="Adicione uma descrição..."
                              rows={4}
                              disabled={!canEdit}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <section>
                      <div className="flex items-center justify-between mb-3">
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
                          <div className="space-y-2">
                            {subtarefas.map((sub) => (
                              <div key={sub.id} className="flex items-center gap-2 group">
                                <Checkbox
                                  checked={sub.concluida}
                                  disabled={!canEdit}
                                  onCheckedChange={async (checked) => {
                                    try {
                                      await toggleSubtarefa.mutateAsync({
                                        id: sub.id,
                                        concluida: !!checked,
                                      });
                                    } catch (error) {
                                      toast.error(getSupabaseErrorMessage(error as Error));
                                    }
                                  }}
                                />
                                <span
                                  className={
                                    sub.concluida
                                      ? "line-through text-muted-foreground text-sm flex-1"
                                      : "text-sm flex-1"
                                  }
                                >
                                  {sub.titulo}
                                </span>
                                {canEdit && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 opacity-0 group-hover:opacity-100"
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
                            ))}
                          </div>
                          {canEdit && (
                            <div className="flex gap-2 mt-3">
                              <Input
                                placeholder="Adicionar subtarefa..."
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
                        </>
                      )}
                    </section>

                    {showInteractions && (
                      <>
                        <Separator />
                        <TarefaAnexosSection
                          tarefaId={tarefaId!}
                          anexos={anexos}
                          canEdit={canEdit}
                        />
                      </>
                    )}

                    <Separator />

                    <section>
                      <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                        <MessageSquare className="h-4 w-4" />
                        Comentários ({comentarios.length})
                      </h3>
                      {!showInteractions ? (
                        <p className="text-sm text-muted-foreground">
                          Salve a tarefa para adicionar comentários.
                        </p>
                      ) : (
                        <>
                          <div className="space-y-4">
                            {comentarios.map((c) => (
                              <div key={c.id} className="flex gap-3 group">
                                <ProfileAvatar
                                  name={c.usuario?.nome_completo ?? "?"}
                                  avatarUrl={c.usuario?.avatar_url}
                                  className="h-8 w-8 shrink-0"
                                />
                                <div className="flex-1 min-w-0">
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
                                        className="h-6 w-6 ml-auto opacity-0 group-hover:opacity-100"
                                        onClick={async () => {
                                          try {
                                            await deleteComentario.mutateAsync(c.id);
                                          } catch (error) {
                                            toast.error(getSupabaseErrorMessage(error as Error));
                                          }
                                        }}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">
                                    {c.conteudo}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-4 space-y-2">
                            {canEdit && (
                              <>
                                <Textarea
                                  placeholder="Escreva um comentário..."
                                  rows={3}
                                  value={novoComentario}
                                  onChange={(e) => setNovoComentario(e.target.value)}
                                />
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={handleAddComentario}
                                    disabled={!novoComentario.trim() || createComentario.isPending}
                                  >
                                    Comentar
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </section>
                  </div>
                </ScrollArea>

                <aside className="w-full lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l bg-muted/20">
                  <ScrollArea className="h-full max-h-[calc(100vh-8rem)]">
                    <div className="p-4 space-y-5">
                      <FormField
                        control={form.control}
                        name="setor_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Projeto</FormLabel>
                            <Select
                              value={field.value ?? "none"}
                              onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                              disabled={!canEdit}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Setor" />
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
                        name="atribuido_a"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Responsável pela tarefa</FormLabel>
                            <Select
                              value={field.value ?? "none"}
                              onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                              disabled={!canEdit}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Responsável" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none">Ninguém</SelectItem>
                                {pessoasAtivas.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.nome_completo}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {responsavelDisplay && (
                              <div className="flex items-center gap-2 pt-1">
                                <ProfileAvatar
                                  name={responsavelDisplay.nome_completo}
                                  avatarUrl={
                                    "avatar_url" in responsavelDisplay
                                      ? responsavelDisplay.avatar_url
                                      : null
                                  }
                                  className="h-7 w-7"
                                />
                                <span className="text-xs text-muted-foreground">
                                  {responsavelDisplay.nome_completo}
                                </span>
                              </div>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="data_inicio"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Data</FormLabel>
                            <DateField
                              label=""
                              value={field.value}
                              onChange={field.onChange}
                              disabled={!canEdit}
                            />
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="data_vencimento"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Prazo</FormLabel>
                            <DateField
                              label=""
                              value={field.value}
                              onChange={field.onChange}
                              disabled={!canEdit}
                            />
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
                            <Select
                              value={field.value}
                              onValueChange={(v) => field.onChange(v as TarefaPrioridade)}
                              disabled={!canEdit}
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
                            <Select
                              value={field.value}
                              onValueChange={(v) => field.onChange(v as TarefaStatus)}
                              disabled={!canEdit}
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
                            <FormControl>
                              <Input
                                placeholder="urgente, cliente-x"
                                disabled={!canEdit}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="lembretes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <Bell className="h-4 w-4" />
                              Lembretes
                            </FormLabel>
                            <div className="space-y-2 rounded-lg border p-3">
                              {(Object.keys(TAREFA_LEMBRETE_LABELS) as TarefaLembreteOpcao[]).map(
                                (opcao) => (
                                  <label key={opcao} className="flex items-center gap-2 text-sm">
                                    <Checkbox
                                      checked={field.value.includes(opcao)}
                                      disabled={!canEdit}
                                      onCheckedChange={(checked) =>
                                        toggleLembrete(opcao, !!checked)
                                      }
                                    />
                                    {TAREFA_LEMBRETE_LABELS[opcao]}
                                  </label>
                                ),
                              )}
                            </div>
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
                            <Select
                              value={field.value}
                              onValueChange={(v) => field.onChange(v as TarefaVisibilidade)}
                              disabled={!canEditVisibility}
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
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {visibilidade === "pessoas_especificas" && (
                        <FormField
                          control={form.control}
                          name="observador_ids"
                          render={() => (
                            <FormItem>
                              <FormLabel>Pessoas com acesso</FormLabel>
                              <div className="space-y-2 rounded-lg border p-3 max-h-40 overflow-y-auto">
                                {pessoasAtivas.map((p: ProfileWithSetor) => (
                                  <label key={p.id} className="flex items-center gap-2 text-sm">
                                    <Checkbox
                                      checked={form.watch("observador_ids").includes(p.id)}
                                      disabled={!canEditVisibility}
                                      onCheckedChange={(checked) =>
                                        toggleObservador(p.id, !!checked)
                                      }
                                    />
                                    <ProfileAvatar
                                      name={p.nome_completo}
                                      avatarUrl={p.avatar_url}
                                      className="h-6 w-6"
                                    />
                                    {p.nome_completo}
                                  </label>
                                ))}
                              </div>
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
                    </div>
                  </ScrollArea>
                </aside>
              </div>
            </form>
          </Form>
        )}
      </SheetContent>
    </Sheet>
  );
}
