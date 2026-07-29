import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, MessageSquare, Paperclip } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { CommentsThread } from "@/components/common/comments-thread";
import { EditableOnDoubleClick } from "@/components/common/editable-on-double-click";
import { SubtarefaAnexosSection } from "@/components/tarefas/subtarefa-anexos-section";
import { TarefaMetaToolbar } from "@/components/tarefas/tarefa-meta-toolbar";
import { TarefaPeopleStrip } from "@/components/tarefas/tarefa-people-strip";
import { Badge } from "@/components/ui/badge";
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
import { DescricaoField } from "@/components/tarefas/descricao-field";
import { usePessoas } from "@/hooks/use-pessoas";
import { useProjetos } from "@/hooks/use-projetos";
import { useProfile } from "@/hooks/use-profile";
import { useSetores } from "@/hooks/use-setores";
import {
  useCreateSubtarefaComentario,
  useDeleteSubtarefaComentario,
  useSubtarefaDetail,
  useToggleSubtarefaComentarioReacao,
  useUpdateSubtarefa,
  useUpdateSubtarefaComentario,
} from "@/hooks/use-tarefas";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import type {
  SubtarefaDetail,
  SubtarefaFormData,
  TarefaWithRelations,
} from "@/types";
import { isAdmin, isGerente } from "@/utils/permissions";
import {
  filterPessoasPorEscopo,
  getSubtarefaEscopoIds,
  getTarefaEscopoIds,
  VISIBILIDADE_PESSOAS,
} from "@/utils/escopo-tarefa";
import {
  TAREFA_PRIORIDADE_COLORS,
  canCommentOrAttachTarefa,
  canEditTarefa,
  canEditVisibilidade,
  getSetoresPermitidos,
  getTarefaConclusaoColorClass,
  getTarefaConclusaoLabel,
  parseLembretes,
} from "@/utils/tarefas";

const subtarefaPanelSchema = z.object({
  titulo: z.string().min(2, "Título deve ter pelo menos 2 caracteres"),
  descricao: z.string(),
  projeto_id: z.string().nullable(),
  setor_id: z.string().nullable(),
  atribuido_ids: z.array(z.string()),
  prioridade: z.enum(["P1", "P2", "P3", "P4"]),
  data_inicio: z.date().nullable(),
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
  const atribuidoIds = subtarefa?.responsaveis?.map((r) => r.usuario_id) ?? [];
  const ownObservadores = subtarefa?.observadores?.map((o) => o.usuario_id) ?? [];
  const visibilidadeJaConfigurada = subtarefa?.visibilidade === VISIBILIDADE_PESSOAS;
  // Enquanto não configurada: Visibilidade inicia igual aos Responsáveis.
  const observadorIds = visibilidadeJaConfigurada
    ? ownObservadores
    : ownObservadores.length > 0
      ? ownObservadores
      : atribuidoIds;

  return {
    titulo: subtarefa?.titulo ?? "",
    descricao: subtarefa?.descricao ?? "",
    // Sempre herda da tarefa principal — subtarefa não diverge.
    projeto_id: parentTarefa?.projeto_id ?? subtarefa?.projeto_id ?? null,
    setor_id: parentTarefa?.setor_id ?? subtarefa?.setor_id ?? null,
    atribuido_ids: atribuidoIds,
    prioridade: subtarefa?.prioridade ?? "P4",
    data_inicio: subtarefa?.data_inicio ? new Date(subtarefa.data_inicio) : null,
    visibilidade: VISIBILIDADE_PESSOAS,
    observador_ids: observadorIds,
    lembretes: parseLembretes(subtarefa?.lembretes),
    // Campos mantidos no schema (toolbar com hideRecorrencia) — sempre nenhuma
    recorrencia_tipo: "nenhuma",
    recorrencia_dias_semana: [],
    recorrencia_dia_mes: 1,
    recorrencia_data_fim: null,
  };
}

function toPayload(
  values: SubtarefaPanelSchema,
  parentTarefa?: Pick<TarefaWithRelations, "projeto_id" | "setor_id"> | null,
): SubtarefaFormData {
  return {
    titulo: values.titulo,
    descricao: values.descricao,
    projeto_id: parentTarefa?.projeto_id ?? values.projeto_id,
    setor_id: parentTarefa?.setor_id ?? values.setor_id,
    atribuido_ids: values.atribuido_ids,
    prioridade: values.prioridade,
    data_inicio: values.data_inicio ? values.data_inicio.toISOString() : null,
    // Subtarefas não possuem recorrência — só a tarefa principal
    recorrencia: null,
    visibilidade: VISIBILIDADE_PESSOAS,
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
  initialAba,
  highlightComentarioId = null,
}: {
  subtarefaId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentTarefa?: TarefaWithRelations | null;
  readOnly?: boolean;
  initialAba?: "comentarios" | "anexos";
  highlightComentarioId?: string | null;
}) {
  const { data: profile } = useProfile();
  const { data: setores } = useSetores();
  const { data: projetos } = useProjetos();
  const { data: pessoas } = usePessoas();
  const { data: subtarefa, isLoading } = useSubtarefaDetail(open ? subtarefaId : null);
  const updateSubtarefa = useUpdateSubtarefa();
  const createComentario = useCreateSubtarefaComentario();
  const deleteComentario = useDeleteSubtarefaComentario();
  const updateComentario = useUpdateSubtarefaComentario();
  const toggleComentarioReacao = useToggleSubtarefaComentarioReacao();

  const [sideTab, setSideTab] = useState<"comentarios" | "anexos">(
    initialAba ?? "comentarios",
  );
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const savingRef = useRef(false);
  /** Visibilidade acompanha Responsáveis até edição manual (primeira configuração). */
  const visibilidadeManualRef = useRef(false);

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

  /** Visualizadores (e quem tem leitura) podem comentar/anexar sem editar campos. */
  const canCommentOrAttach = useMemo(
    () => canCommentOrAttachTarefa(parentTarefa, profile?.id, readOnly),
    [parentTarefa, profile?.id, readOnly],
  );

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
  const visibilidade = form.watch("visibilidade");
  const selectedProjeto = projetos?.find((p) => p.id === projetoId);
  const selectedSetor = setores?.find((s) => s.id === setorId);

  const escopoPaiIds = useMemo(
    () =>
      getTarefaEscopoIds({
        criado_por: parentTarefa?.criado_por,
        atribuido_a: parentTarefa?.atribuido_a,
        responsaveis: parentTarefa?.responsaveis,
        observadores: parentTarefa?.observadores,
      }),
    [parentTarefa],
  );

  const pessoasDoEscopoPai = useMemo(
    () => filterPessoasPorEscopo(pessoasAtivas, escopoPaiIds),
    [pessoasAtivas, escopoPaiIds],
  );

  const pessoasParaResponsavel = pessoasDoEscopoPai;
  const pessoasParaVisibilidade = pessoasDoEscopoPai;

  useLayoutEffect(() => {
    if (!open) {
      setEditingField(null);
      return;
    }
    // Já configurada como lista de pessoas → não sincroniza mais com responsáveis.
    visibilidadeManualRef.current = subtarefa?.visibilidade === VISIBILIDADE_PESSOAS;
    form.reset(toFormValues(subtarefa ?? null, parentTarefa));
  }, [open, subtarefa, parentTarefa, form]);

  // Enquanto Visibilidade não for editada manualmente, acompanha Responsáveis.
  useEffect(() => {
    if (!open || visibilidadeManualRef.current) return;
    form.setValue("observador_ids", atribuidoIds ?? [], { shouldDirty: false });
    form.setValue("visibilidade", VISIBILIDADE_PESSOAS, { shouldDirty: false });
  }, [open, atribuidoIds, form]);

  useEffect(() => {
    if (!open) return;
    setSideTab(initialAba ?? "comentarios");
    setEditingField(null);
  }, [open, subtarefaId, initialAba]);

  useEffect(() => {
    if (!open || !highlightComentarioId) return;
    setSideTab("comentarios");
    const timer = window.setTimeout(() => {
      document
        .getElementById(`subtarefa-comentario-${highlightComentarioId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [open, highlightComentarioId, subtarefa?.comentarios]);

  const comentarios = subtarefa?.comentarios ?? [];
  const anexos = subtarefa?.anexos ?? [];
  const parentTitle =
    subtarefa?.tarefa?.titulo ?? parentTarefa?.titulo ?? "Tarefa principal";

  const criadorDisplay = useMemo(() => {
    if (subtarefa?.criador) return subtarefa.criador;
    if (profile) {
      return {
        id: profile.id,
        nome_completo: profile.nome_completo,
        avatar_url: profile.avatar_url,
      };
    }
    return null;
  }, [subtarefa?.criador, profile]);

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

  const pessoasMencionaveis = useMemo(() => {
    const escopoIds = getSubtarefaEscopoIds({
      criado_por: subtarefa?.criado_por ?? profile?.id,
      atribuido_ids: atribuidoIds,
      observadores: (observadorIds ?? []).map((usuario_id) => ({ usuario_id })),
    });
    return filterPessoasPorEscopo(pessoasAtivas, escopoIds);
  }, [
    atribuidoIds,
    observadorIds,
    subtarefa?.criado_por,
    profile?.id,
    pessoasAtivas,
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
        data: toPayload(form.getValues(), parentTarefa),
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
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[560px] z-[70] [&>button]:right-3 [&>button]:top-3 [&>button>svg]:h-3.5 [&>button>svg]:w-3.5"
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
          <div className="space-y-3 p-4 pt-10">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-20 w-full" />
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
              <SheetHeader className="shrink-0 space-y-0 border-b px-4 py-2.5 pr-10 text-left">
                <SheetTitle className="sr-only">
                  Subtarefa de {parentTitle}
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Detalhes, anexos e comentários da subtarefa.
                </SheetDescription>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => void handleOpenChange(false)}
                  >
                    <ArrowLeft className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      Subtarefa de:{" "}
                      <span className="font-medium text-foreground">{parentTitle}</span>
                    </span>
                  </button>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge
                      variant="outline"
                      className={`px-1.5 py-0 text-[10px] ${TAREFA_PRIORIDADE_COLORS[subtarefa.prioridade]}`}
                    >
                      {subtarefa.prioridade}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className={`px-1.5 py-0 text-[10px] ${getTarefaConclusaoColorClass(subtarefa.concluida)}`}
                    >
                      {getTarefaConclusaoLabel(subtarefa.concluida)}
                    </Badge>
                  </div>
                </div>
              </SheetHeader>

              <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                <ScrollArea className="min-h-0 flex-1">
                  <div className="space-y-3 p-4">
                    <TarefaMetaToolbar
                      form={form as never}
                      canEdit={canEdit}
                      canEditVisibility={canEditVisibility}
                      hideProjetoSetor
                      hideRecorrencia
                      compact
                      projetos={projetos ?? []}
                      setores={setoresPermitidos}
                      pessoasParaResponsavel={pessoasParaResponsavel}
                      pessoasParaVisibilidade={pessoasParaVisibilidade}
                      requireResponsavel={false}
                      onVisibilidadeManualChange={() => {
                        visibilidadeManualRef.current = true;
                      }}
                      emptyResponsavelLabel="Nenhuma pessoa no escopo da tarefa"
                      emptyVisibilidadeLabel="Nenhuma pessoa no escopo da tarefa"
                    />

                    <TarefaPeopleStrip
                      criador={criadorDisplay}
                      createdAt={subtarefa?.created_at ?? null}
                      responsaveis={responsaveisDisplay}
                      visibilidade={visibilidade}
                      visualizadores={visualizadoresDisplay}
                      setorNome={selectedSetor?.nome}
                      projetoNome={selectedProjeto?.nome}
                      compact
                    />

                    {(formErrors.visibilidade ||
                      formErrors.setor_id ||
                      formErrors.projeto_id ||
                      formErrors.observador_ids) && (
                      <div
                        role="alert"
                        className="rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive"
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
                                  className="h-9 rounded-lg border bg-card px-2.5 py-1.5 text-sm font-semibold shadow-sm focus-visible:ring-1"
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
                                <DescricaoField
                                  value={field.value ?? ""}
                                  onChange={field.onChange}
                                  onBlur={field.onBlur}
                                  editable={editable}
                                  disabled={!canEdit}
                                  editorKey={subtarefaId ?? "subtarefa"}
                                  placeholder="Adicione uma descrição... (duplo clique para editar)"
                                  minHeightClassName="[&_.ProseMirror]:min-h-[8rem] text-sm"
                                  readMinHeightClassName="min-h-[8rem] text-sm"
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

                <aside className="flex w-full shrink-0 flex-col border-t bg-muted/20 lg:w-52 lg:border-l lg:border-t-0">
                  <Tabs
                    value={sideTab}
                    onValueChange={(value) => setSideTab(value as "comentarios" | "anexos")}
                    className="flex min-h-0 flex-1 flex-col"
                  >
                    <TabsList className="mx-3 mt-3 grid h-8 w-auto grid-cols-2">
                      <TabsTrigger value="anexos" className="gap-1 px-2 text-[11px]">
                        <Paperclip className="h-3 w-3" />
                        Anexos
                        {anexos.length > 0 && (
                          <span className="text-muted-foreground">({anexos.length})</span>
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="comentarios" className="gap-1 px-2 text-[11px]">
                        <MessageSquare className="h-3 w-3" />
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
                      <ScrollArea className="h-full max-h-[calc(100vh-11rem)] [&>[data-radix-scroll-area-viewport]>div]:!block">
                        <div className="w-full space-y-2 p-3">
                          <SubtarefaAnexosSection
                            subtarefaId={subtarefa.id}
                            anexos={anexos}
                            canEdit={canEdit}
                            canUpload={canCommentOrAttach}
                            hideTitle
                            compact
                          />
                        </div>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent
                      value="comentarios"
                      className="mt-0 min-h-0 flex-1 data-[state=inactive]:hidden"
                    >
                      <ScrollArea className="h-full max-h-[calc(100vh-11rem)]">
                        <div className="p-3">
                          <CommentsThread
                            comentarios={comentarios}
                            pessoasMencionaveis={pessoasMencionaveis}
                            currentUserId={profile?.id}
                            currentUserProfile={profile}
                            canComment={canCommentOrAttach}
                            highlightId={highlightComentarioId}
                            idPrefix="subtarefa-comentario"
                            pending={createComentario.isPending}
                            compact
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
                            onEdit={async (id, conteudo) => {
                              try {
                                await updateComentario.mutateAsync({
                                  id,
                                  subtarefaId: subtarefa.id,
                                  conteudo,
                                });
                              } catch (error) {
                                toast.error("Erro ao editar comentário", {
                                  description: getSupabaseErrorMessage(error as Error),
                                });
                                throw error;
                              }
                            }}
                            canReact={canCommentOrAttach}
                            onToggleReacao={async (comentarioId) => {
                              try {
                                await toggleComentarioReacao.mutateAsync({
                                  comentarioId,
                                  subtarefaId: subtarefa.id,
                                });
                              } catch (error) {
                                toast.error("Erro ao reagir", {
                                  description: getSupabaseErrorMessage(error as Error),
                                });
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

              {canEdit && (
                <div className="border-t px-4 py-1.5 text-[10px] text-muted-foreground">
                  {updateSubtarefa.isPending
                    ? "Salvando alterações..."
                    : "Salvo automaticamente"}
                </div>
              )}
            </form>
          </Form>
        )}
      </SheetContent>
    </Sheet>
  );
}
