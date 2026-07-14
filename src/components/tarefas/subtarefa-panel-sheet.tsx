import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, MessageSquare, Paperclip } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { CommentsThread } from "@/components/common/comments-thread";
import { EditableOnDoubleClick } from "@/components/common/editable-on-double-click";
import { SubtarefaAnexosSection } from "@/components/tarefas/subtarefa-anexos-section";
import { TarefaMetaToolbar } from "@/components/tarefas/tarefa-meta-toolbar";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { usePessoas } from "@/hooks/use-pessoas";
import { useProjetos } from "@/hooks/use-projetos";
import { useProfile } from "@/hooks/use-profile";
import { useSetores } from "@/hooks/use-setores";
import {
  useCreateSubtarefaComentario,
  useDeleteSubtarefaComentario,
  useSubtarefaDetail,
  useUpdateSubtarefa,
} from "@/hooks/use-tarefas";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import { listProjetoMembros } from "@/services/projetos";
import type {
  RecorrenciaConfig,
  RecorrenciaTipo,
  SubtarefaDetail,
  SubtarefaFormData,
  TarefaVisibilidade,
  TarefaWithRelations,
} from "@/types";
import { parseRecorrencia } from "@/utils/recorrencia";
import { isAdmin, isGerente } from "@/utils/permissions";
import {
  TAREFA_PRIORIDADE_COLORS,
  TAREFA_STATUS_COLORS,
  TAREFA_STATUS_LABELS,
  canEditTarefa,
  canEditVisibilidade,
  getSetoresPermitidos,
  parseLembretes,
} from "@/utils/tarefas";

const subtarefaPanelSchema = z
  .object({
    titulo: z.string().min(2, "Título deve ter pelo menos 2 caracteres"),
    descricao: z.string(),
    projeto_id: z.string().nullable(),
    setor_id: z.string().nullable(),
    atribuido_ids: z.array(z.string()),
    prioridade: z.enum(["P1", "P2", "P3", "P4"]),
    status: z.enum(["a_fazer", "em_andamento", "cancelada", "concluida"]),
    data_inicio: z.date().nullable(),
    data_vencimento: z.date().nullable(),
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

type SubtarefaPanelSchema = z.infer<typeof subtarefaPanelSchema>;
type EditableField = "titulo" | "descricao";

function toFormValues(
  subtarefa?: SubtarefaDetail | null,
  parentTarefa?: Pick<
    TarefaWithRelations,
    "projeto_id" | "setor_id" | "visibilidade" | "observadores"
  > | null,
): SubtarefaPanelSchema {
  const rec = parseRecorrencia(subtarefa?.recorrencia);
  const atribuidoIds = subtarefa?.responsaveis?.map((r) => r.usuario_id) ?? [];
  const inheritedVisibilidade =
    (subtarefa?.visibilidade as TarefaVisibilidade | null | undefined) ??
    (parentTarefa?.visibilidade as TarefaVisibilidade | undefined) ??
    "somente_para_mim";
  const ownObservadores = subtarefa?.observadores?.map((o) => o.usuario_id) ?? [];
  const parentObservadores = parentTarefa?.observadores?.map((o) => o.usuario_id) ?? [];

  return {
    titulo: subtarefa?.titulo ?? "",
    descricao: subtarefa?.descricao ?? "",
    projeto_id: subtarefa?.projeto_id ?? parentTarefa?.projeto_id ?? null,
    setor_id: subtarefa?.setor_id ?? parentTarefa?.setor_id ?? null,
    atribuido_ids: atribuidoIds,
    prioridade: subtarefa?.prioridade ?? "P4",
    status: subtarefa?.status ?? (subtarefa?.concluida ? "concluida" : "a_fazer"),
    data_inicio: subtarefa?.data_inicio ? new Date(subtarefa.data_inicio) : null,
    data_vencimento: subtarefa?.data_vencimento
      ? new Date(subtarefa.data_vencimento)
      : null,
    visibilidade: inheritedVisibilidade,
    observador_ids:
      ownObservadores.length > 0
        ? ownObservadores
        : inheritedVisibilidade === "pessoas_especificas" && !subtarefa?.visibilidade
          ? parentObservadores
          : ownObservadores,
    lembretes: parseLembretes(subtarefa?.lembretes),
    recorrencia_tipo: rec?.tipo ?? "nenhuma",
    recorrencia_dias_semana: rec?.dias_semana ?? [],
    recorrencia_dia_mes: rec?.dia_mes ?? 1,
    recorrencia_data_fim: rec?.data_fim ? new Date(rec.data_fim) : null,
  };
}

function toRecorrenciaPayload(values: SubtarefaPanelSchema): RecorrenciaConfig | null {
  if (values.recorrencia_tipo === "nenhuma") return null;
  return {
    tipo: values.recorrencia_tipo as RecorrenciaTipo,
    dias_semana:
      values.recorrencia_tipo === "semanal" ? values.recorrencia_dias_semana : undefined,
    dia_mes: values.recorrencia_tipo === "mensal" ? values.recorrencia_dia_mes : undefined,
    data_fim: values.recorrencia_data_fim ? values.recorrencia_data_fim.toISOString() : null,
  };
}

function toPayload(values: SubtarefaPanelSchema): SubtarefaFormData {
  return {
    titulo: values.titulo,
    descricao: values.descricao,
    projeto_id: values.projeto_id,
    setor_id: values.setor_id,
    atribuido_ids: values.atribuido_ids,
    prioridade: values.prioridade,
    status: values.status,
    data_inicio: values.data_inicio ? values.data_inicio.toISOString() : null,
    data_vencimento: values.data_vencimento ? values.data_vencimento.toISOString() : null,
    recorrencia: toRecorrenciaPayload(values),
    visibilidade: values.visibilidade,
    observador_ids: values.observador_ids,
    lembretes: values.lembretes,
  };
}

export function SubtarefaPanelSheet({
  subtarefaId,
  open,
  onOpenChange,
  parentTarefa,
  readOnly = false,
}: {
  subtarefaId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentTarefa?: TarefaWithRelations | null;
  readOnly?: boolean;
}) {
  const { data: profile } = useProfile();
  const { data: setores } = useSetores();
  const { data: projetos } = useProjetos();
  const { data: pessoas } = usePessoas();
  const { data: subtarefa, isLoading } = useSubtarefaDetail(open ? subtarefaId : null);
  const updateSubtarefa = useUpdateSubtarefa();
  const createComentario = useCreateSubtarefaComentario();
  const deleteComentario = useDeleteSubtarefaComentario();

  const [sideTab, setSideTab] = useState<"comentarios" | "anexos">("comentarios");
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const savingRef = useRef(false);

  const form = useForm<SubtarefaPanelSchema>({
    resolver: zodResolver(subtarefaPanelSchema),
    defaultValues: toFormValues(null, parentTarefa),
  });

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
    if (!parentTarefa || !profile) return false;
    return canEditTarefa(
      parentTarefa,
      profile.id,
      isAdmin(profile),
      isGerente(profile),
      profile.setor_id,
    );
  }, [readOnly, parentTarefa, profile]);

  const canEditVisibility = useMemo(() => {
    if (readOnly) return false;
    return canEditVisibilidade(
      parentTarefa,
      profile?.id,
      isAdmin(profile),
      isGerente(profile),
      profile?.setor_id,
    );
  }, [readOnly, parentTarefa, profile]);

  const projetoId = form.watch("projeto_id");
  const setorId = form.watch("setor_id");
  const atribuidoIds = form.watch("atribuido_ids");
  const observadorIds = form.watch("observador_ids");

  const { data: projetoMembros } = useQuery({
    queryKey: ["projeto-membros", projetoId],
    queryFn: () => listProjetoMembros(projetoId!),
    enabled: !!projetoId,
  });

  const pessoasParaResponsavel = useMemo(() => {
    if (!projetoId) return pessoasAtivas;
    const memberIds = new Set((projetoMembros ?? []).map((m) => m.id));
    const selected = new Set(atribuidoIds ?? []);
    return pessoasAtivas.filter((p) => memberIds.has(p.id) || selected.has(p.id));
  }, [projetoId, projetoMembros, pessoasAtivas, atribuidoIds]);

  useEffect(() => {
    if (!open) {
      setEditingField(null);
      return;
    }
    form.reset(toFormValues(subtarefa ?? null, parentTarefa));
  }, [open, subtarefa, parentTarefa, form]);

  useEffect(() => {
    if (!open) return;
    setSideTab("comentarios");
    setEditingField(null);
  }, [open, subtarefaId]);

  const comentarios = subtarefa?.comentarios ?? [];
  const anexos = subtarefa?.anexos ?? [];
  const parentTitle =
    subtarefa?.tarefa?.titulo ?? parentTarefa?.titulo ?? "Tarefa principal";

  const pessoasMencionaveis = useMemo(() => {
    const ids = new Set<string>([...(atribuidoIds ?? []), ...(observadorIds ?? [])]);
    if (subtarefa?.criado_por) ids.add(subtarefa.criado_por);
    if (parentTarefa?.criado_por) ids.add(parentTarefa.criado_por);
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
    subtarefa?.criado_por,
    parentTarefa?.criado_por,
    projetoId,
    projetoMembros,
    setorId,
    pessoasAtivas,
    comentarios,
  ]);

  const persistChanges = async (): Promise<boolean> => {
    if (!subtarefaId || !subtarefa || !canEdit || savingRef.current) return true;
    const valid = await form.trigger();
    if (!valid) {
      const errors = form.formState.errors;
      const messages = Object.values(errors)
        .map((error) =>
          error && typeof error === "object" && "message" in error
            ? String(error.message ?? "")
            : "",
        )
        .filter(Boolean);
      toast.error("Não foi possível salvar a subtarefa", {
        description: messages[0] ?? "Verifique os campos obrigatórios.",
      });
      return false;
    }

    savingRef.current = true;
    try {
      await updateSubtarefa.mutateAsync({
        id: subtarefaId,
        data: toPayload(form.getValues()),
      });
      return true;
    } catch (error) {
      toast.error("Erro ao salvar subtarefa", {
        description: getSupabaseErrorMessage(error as Error),
      });
      return false;
    } finally {
      savingRef.current = false;
    }
  };

  const handleOpenChange = async (next: boolean) => {
    if (!next) {
      const ok = await persistChanges();
      if (!ok) return;
    }
    onOpenChange(next);
  };

  const {
    formState: { errors: formErrors },
  } = form;

  return (
    <Sheet open={open} onOpenChange={(next) => void handleOpenChange(next)}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-xl md:max-w-2xl lg:max-w-3xl z-[70]"
        onInteractOutside={(event) => {
          // Mantém o drawer aberto ao usar seletor de arquivos / cliques no overlay do dialog pai
          event.preventDefault();
        }}
        onFocusOutside={(event) => {
          event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          event.preventDefault();
        }}
      >
        {isLoading || !subtarefa ? (
          <div className="space-y-4 p-6 pt-12">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <Form {...form}>
            <form
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={(event) => {
                event.preventDefault();
                void handleOpenChange(false);
              }}
            >
              <SheetHeader className="shrink-0 space-y-2 border-b px-6 py-4 pr-12 text-left">
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => void handleOpenChange(false)}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Subtarefa de:{" "}
                  <span className="font-medium text-foreground">{parentTitle}</span>
                </button>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <SheetTitle className="text-left">Subtarefa</SheetTitle>
                    <SheetDescription className="text-left">
                      Campos, anexos e comentários exclusivos desta subtarefa. Fechar salva
                      automaticamente.
                    </SheetDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant="outline"
                      className={TAREFA_PRIORIDADE_COLORS[subtarefa.prioridade]}
                    >
                      {subtarefa.prioridade}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className={TAREFA_STATUS_COLORS[subtarefa.status]}
                    >
                      {TAREFA_STATUS_LABELS[subtarefa.status]}
                    </Badge>
                  </div>
                </div>
              </SheetHeader>

              <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                <ScrollArea className="min-h-0 flex-1">
                  <div className="space-y-4 p-6">
                    <TarefaMetaToolbar
                      form={form as never}
                      canEdit={canEdit}
                      canEditVisibility={canEditVisibility}
                      projetos={projetos ?? []}
                      setores={setoresPermitidos}
                      pessoasParaResponsavel={pessoasParaResponsavel}
                      pessoasAtivas={pessoasAtivas}
                      requireResponsavel={false}
                      emptyResponsavelLabel={
                        projetoId
                          ? "Defina a equipe do projeto antes de atribuir responsáveis"
                          : "Nenhuma pessoa disponível"
                      }
                    />

                    {(formErrors.visibilidade ||
                      formErrors.setor_id ||
                      formErrors.projeto_id ||
                      formErrors.observador_ids) && (
                      <div
                        role="alert"
                        className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                      >
                        {formErrors.observador_ids?.message ||
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
                            forceEditable={false}
                            editing={editingField === "titulo"}
                            onStartEdit={() => setEditingField("titulo")}
                            onEndEdit={() => setEditingField(null)}
                          >
                            {(editable) => (
                              <FormControl>
                                <Input
                                  placeholder="Título da subtarefa"
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
                            onStartEdit={() => setEditingField("descricao")}
                            onEndEdit={() => setEditingField(null)}
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
                  </div>
                </ScrollArea>

                <aside className="flex w-full shrink-0 flex-col border-t bg-muted/20 lg:w-80 lg:border-l lg:border-t-0">
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
                      <ScrollArea className="h-full max-h-[calc(100vh-12rem)]">
                        <div className="space-y-3 p-4">
                          <SubtarefaAnexosSection
                            subtarefaId={subtarefa.id}
                            anexos={anexos}
                            canEdit={canEdit}
                            hideTitle
                          />
                        </div>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent
                      value="comentarios"
                      className="mt-0 min-h-0 flex-1 data-[state=inactive]:hidden"
                    >
                      <ScrollArea className="h-full max-h-[calc(100vh-12rem)]">
                        <div className="p-4">
                          <CommentsThread
                            comentarios={comentarios}
                            pessoasMencionaveis={pessoasMencionaveis}
                            currentUserId={profile?.id}
                            canComment={canEdit}
                            idPrefix="subtarefa-comentario"
                            pending={createComentario.isPending}
                            onSubmit={async (conteudo, parentId) => {
                              try {
                                await createComentario.mutateAsync({
                                  subtarefaId: subtarefa.id,
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
                                await deleteComentario.mutateAsync({
                                  id,
                                  subtarefaId: subtarefa.id,
                                });
                              } catch (error) {
                                toast.error(getSupabaseErrorMessage(error as Error));
                                throw error;
                              }
                            }}
                          />
                        </div>
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>
                </aside>
              </div>

              {canEdit && updateSubtarefa.isPending && (
                <div className="border-t px-6 py-2 text-xs text-muted-foreground">
                  Salvando alterações...
                </div>
              )}

              {canEdit && (
                <div className="flex justify-end border-t px-6 py-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleOpenChange(false)}
                  >
                    Fechar
                  </Button>
                </div>
              )}
            </form>
          </Form>
        )}
      </SheetContent>
    </Sheet>
  );
}
