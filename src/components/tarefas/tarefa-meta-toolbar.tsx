import {
  Bell,
  Building2,
  CalendarDays,
  Eye,
  FolderKanban,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo } from "react";
import type { UseFormReturn } from "react-hook-form";
import { PessoasMultiSelect } from "@/components/common/pessoas-multi-select";
import {
  DataHoraRecorrenciaBody,
  formatDataHoraLabel,
} from "@/components/tarefas/data-hora-recorrencia-body";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label";
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
  Projeto,
  RecorrenciaConfig,
  RecorrenciaTipo,
  SetorWithGerente,
  TarefaLembreteOpcao,
  TarefaPrioridade,
  TarefaVisibilidade,
} from "@/types";
import {
  TAREFA_LEMBRETE_LABELS,
  TAREFA_PRIORIDADE_DOT,
  TAREFA_PRIORIDADE_LABELS,
} from "@/utils/tarefas";
import { parseRecorrencia } from "@/utils/recorrencia";

/** Acima de Dialog/Sheet (z-50) e do drawer de subtarefa (z-[70]). */
const META_OVERLAY_Z = "z-[100]";

export type TarefaMetaFormValues = {
  projeto_id: string | null;
  setor_id: string | null;
  atribuido_ids: string[];
  visibilidade: TarefaVisibilidade;
  observador_ids: string[];
  data_inicio: Date | null;
  prioridade: TarefaPrioridade;
  lembretes: TarefaLembreteOpcao[];
};

function MetaIconButton({
  label,
  active,
  disabled,
  compact = false,
  children,
  className,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  compact?: boolean;
  children: ReactNode;
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
            "shrink-0 rounded-lg text-muted-foreground hover:text-foreground",
            compact ? "h-7 w-7" : "h-9 w-9",
            active && "bg-muted text-foreground",
            className,
          )}
          aria-label={label}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className={META_OVERLAY_Z}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function TarefaMetaToolbar({
  form,
  canEdit,
  canEditVisibility,
  lockProjeto,
  hideProjetoSetor = false,
  projetos,
  setores,
  pessoasParaResponsavel,
  pessoasParaVisibilidade,
  emptyResponsavelLabel,
  emptyVisibilidadeLabel = "Nenhuma pessoa disponível",
  requireResponsavel = true,
  /** Subtarefas não possuem recorrência própria. */
  hideRecorrencia = false,
  /** Densidade reduzida (drawer compacto da subtarefa). */
  compact = false,
  onVisibilidadeManualChange,
}: {
  form: UseFormReturn<TarefaMetaFormValues & Record<string, unknown>>;
  canEdit: boolean;
  canEditVisibility: boolean;
  lockProjeto?: boolean;
  /** Oculta Projeto e Setor (ex.: drawer da subtarefa, que herda da tarefa pai). */
  hideProjetoSetor?: boolean;
  projetos: Pick<Projeto, "id" | "nome">[];
  setores: SetorWithGerente[];
  pessoasParaResponsavel: ProfileWithSetor[];
  /** Lista do seletor de Visibilidade (tarefa: todos; subtarefa: escopo da pai). */
  pessoasParaVisibilidade: ProfileWithSetor[];
  emptyResponsavelLabel: string;
  emptyVisibilidadeLabel?: string;
  /** Na tarefa principal é obrigatório; subtarefa pode ficar sem responsável. */
  requireResponsavel?: boolean;
  hideRecorrencia?: boolean;
  compact?: boolean;
  /** Chamado quando o usuário edita a Visibilidade manualmente (desliga sync com responsáveis). */
  onVisibilidadeManualChange?: () => void;
}) {
  const iconClass = compact ? "h-3.5 w-3.5" : "h-4 w-4";
  const projetoId = form.watch("projeto_id");
  const setorId = form.watch("setor_id");
  const atribuidoIds = form.watch("atribuido_ids") ?? [];
  const dataInicio = form.watch("data_inicio");
  const prioridade = form.watch("prioridade");
  const lembretes = form.watch("lembretes") ?? [];
  const recorrenciaTipo = (form.watch("recorrencia_tipo") as RecorrenciaTipo | undefined) ?? "nenhuma";
  const recorrenciaDias = (form.watch("recorrencia_dias_semana") as number[] | undefined) ?? [];
  const recorrenciaDiaMes = (form.watch("recorrencia_dia_mes") as number | undefined) ?? 1;
  const recorrenciaIntervalo = (form.watch("recorrencia_intervalo") as number | undefined) ?? 1;
  const recorrenciaUnidade =
    (form.watch("recorrencia_unidade") as RecorrenciaConfig["unidade"] | undefined) ?? "dias";
  const recorrenciaDatasLivres =
    (form.watch("recorrencia_datas_livres") as string[] | undefined) ?? [];

  const recorrenciaAtual: RecorrenciaConfig | null = useMemo(
    () =>
      recorrenciaTipo === "nenhuma"
        ? null
        : {
            tipo: recorrenciaTipo,
            dias_semana: recorrenciaDias,
            dia_mes: recorrenciaDiaMes,
            intervalo: recorrenciaIntervalo,
            unidade: recorrenciaUnidade,
            datas_livres: recorrenciaDatasLivres,
          },
    [
      recorrenciaTipo,
      recorrenciaDias,
      recorrenciaDiaMes,
      recorrenciaIntervalo,
      recorrenciaUnidade,
      recorrenciaDatasLivres,
    ],
  );

  const projetoNome = projetos.find((p) => p.id === projetoId)?.nome;
  const setorNome = setores.find((s) => s.id === setorId)?.nome;

  const applyRecorrencia = (config: RecorrenciaConfig | null) => {
    form.setValue("recorrencia_tipo", config?.tipo ?? "nenhuma", {
      shouldDirty: true,
    });
    form.setValue("recorrencia_dias_semana", config?.dias_semana ?? [], {
      shouldDirty: true,
    });
    form.setValue("recorrencia_dia_mes", config?.dia_mes ?? 1, {
      shouldDirty: true,
    });
    form.setValue("recorrencia_intervalo", config?.intervalo ?? 1, {
      shouldDirty: true,
    });
    form.setValue("recorrencia_unidade", config?.unidade ?? "dias", {
      shouldDirty: true,
    });
    form.setValue("recorrencia_datas_livres", config?.datas_livres ?? [], {
      shouldDirty: true,
    });
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          "flex flex-wrap items-center border bg-muted/30",
          compact ? "gap-0.5 rounded-lg p-1" : "gap-1 rounded-xl p-1.5",
        )}
      >
        {/* Projeto */}
        {!hideProjetoSetor && (
        <FormField
          control={form.control}
          name="projeto_id"
          render={({ field }) => (
            <FormItem className="space-y-0">
              <Popover>
                <PopoverTrigger asChild>
                  <span>
                    <MetaIconButton
                      label={projetoNome ? `Projeto: ${projetoNome}` : "Projeto"}
                      active={!!field.value}
                      disabled={!canEdit || lockProjeto}
                      compact={compact}
                    >
                      <FolderKanban className={iconClass} />
                    </MetaIconButton>
                  </span>
                </PopoverTrigger>
                <PopoverContent
                  className={cn("w-64 space-y-2 p-3", META_OVERLAY_Z)}
                  align="start"
                >
                  <p className="text-xs font-medium text-muted-foreground">Projeto</p>
                  <Select
                    value={field.value ?? "none"}
                    onValueChange={(v) => {
                      const next = v === "none" ? null : v;
                      field.onChange(next);
                      if (next) form.setValue("atribuido_ids", []);
                    }}
                    disabled={!canEdit || lockProjeto}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Nenhum" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className={META_OVERLAY_Z}>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {projetos.map((projeto) => (
                        <SelectItem key={projeto.id} value={projeto.id}>
                          {projeto.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
        )}

        {/* Setor */}
        {!hideProjetoSetor && (
        <FormField
          control={form.control}
          name="setor_id"
          render={({ field }) => (
            <FormItem className="space-y-0">
              <Popover>
                <PopoverTrigger asChild>
                  <span>
                    <MetaIconButton
                      label={setorNome ? `Setor: ${setorNome}` : "Setor"}
                      active={!!field.value}
                      disabled={!canEdit}
                      compact={compact}
                    >
                      <Building2 className={iconClass} />
                    </MetaIconButton>
                  </span>
                </PopoverTrigger>
                <PopoverContent className={cn("w-64 space-y-2 p-3", META_OVERLAY_Z)} align="start">
                  <p className="text-xs font-medium text-muted-foreground">Setor</p>
                  <Select
                    value={field.value ?? "none"}
                    onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                    disabled={!canEdit}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Nenhum" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className={META_OVERLAY_Z}>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {setores.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
        )}

        {/* Responsável */}
        <FormField
          control={form.control}
          name="atribuido_ids"
          render={({ field }) => (
            <FormItem className="space-y-0">
              <Popover>
                <PopoverTrigger asChild>
                  <span>
                    <MetaIconButton
                      label={
                        atribuidoIds.length
                          ? `Responsáveis: ${atribuidoIds.length}`
                          : requireResponsavel
                            ? "Responsável (obrigatório)"
                            : "Responsável"
                      }
                      active={atribuidoIds.length > 0}
                      disabled={!canEdit}
                      compact={compact}
                      className={
                        requireResponsavel && !atribuidoIds.length
                          ? "text-destructive"
                          : undefined
                      }
                    >
                      <UserRound className={iconClass} />
                    </MetaIconButton>
                  </span>
                </PopoverTrigger>
                <PopoverContent className={cn("w-80 space-y-2 p-3", META_OVERLAY_Z)} align="start">
                  <p className="text-xs font-medium text-muted-foreground">Responsáveis</p>
                  <PessoasMultiSelect
                    pessoas={pessoasParaResponsavel}
                    value={field.value}
                    onChange={field.onChange}
                    disabled={!canEdit}
                    placeholder={
                      requireResponsavel
                        ? "Selecione responsáveis"
                        : "Nenhum responsável"
                    }
                    emptyLabel={emptyResponsavelLabel}
                    inline
                  />
                  <FormMessage />
                </PopoverContent>
              </Popover>
            </FormItem>
          )}
        />

        {/* Visibilidade — seletor de pessoas (mesmo componente dos Responsáveis) */}
        <FormField
          control={form.control}
          name="observador_ids"
          render={({ field }) => (
            <FormItem className="space-y-0">
              <Popover>
                <PopoverTrigger asChild>
                  <span>
                    <MetaIconButton
                      label={
                        field.value?.length
                          ? `Visibilidade: ${field.value.length}`
                          : "Visibilidade"
                      }
                      active={(field.value?.length ?? 0) > 0}
                      disabled={!canEditVisibility}
                      compact={compact}
                    >
                      <Eye className={iconClass} />
                    </MetaIconButton>
                  </span>
                </PopoverTrigger>
                <PopoverContent className={cn("w-80 space-y-2 p-3", META_OVERLAY_Z)} align="start">
                  <p className="text-xs font-medium text-muted-foreground">Visibilidade</p>
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    Criador e responsáveis sempre têm acesso, mesmo fora desta lista.
                  </p>
                  <PessoasMultiSelect
                    pessoas={pessoasParaVisibilidade}
                    value={field.value ?? []}
                    onChange={(ids) => {
                      field.onChange(ids);
                      form.setValue("visibilidade", "pessoas_especificas", {
                        shouldDirty: true,
                      });
                      onVisibilidadeManualChange?.();
                    }}
                    disabled={!canEditVisibility}
                    placeholder="Selecione pessoas"
                    emptyLabel={emptyVisibilidadeLabel}
                    searchPlaceholder="Buscar por nome..."
                    inline
                  />
                  <FormMessage />
                </PopoverContent>
              </Popover>
            </FormItem>
          )}
        />

        {/* Data + Hora + Recorrência (popup único) */}
        <FormField
          control={form.control}
          name="data_inicio"
          render={({ field }) => (
            <FormItem className="space-y-0">
              <Popover>
                <PopoverTrigger asChild>
                  <span>
                    <MetaIconButton
                      label={formatDataHoraLabel(dataInicio)}
                      active={!!dataInicio || !!parseRecorrencia(recorrenciaAtual)}
                      disabled={!canEdit}
                      compact={compact}
                    >
                      <CalendarDays className={iconClass} />
                    </MetaIconButton>
                  </span>
                </PopoverTrigger>
                <PopoverContent className={cn("w-auto p-0", META_OVERLAY_Z)} align="start">
                  <DataHoraRecorrenciaBody
                    value={field.value}
                    onChange={field.onChange}
                    canEdit={canEdit}
                    showRecorrencia={!hideRecorrencia}
                    recorrencia={recorrenciaAtual}
                    onRecorrenciaChange={hideRecorrencia ? undefined : applyRecorrencia}
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Prioridade */}
        <FormField
          control={form.control}
          name="prioridade"
          render={({ field }) => (
            <FormItem className="space-y-0">
              <Popover>
                <PopoverTrigger asChild>
                  <span>
                    <MetaIconButton
                      label={`Prioridade: ${field.value}`}
                      active
                      disabled={!canEdit}
                      compact={compact}
                    >
                      <span
                        className={cn(
                          "rounded-full",
                          compact ? "h-3 w-3" : "h-3.5 w-3.5",
                          TAREFA_PRIORIDADE_DOT[prioridade],
                        )}
                      />
                    </MetaIconButton>
                  </span>
                </PopoverTrigger>
                <PopoverContent className={cn("w-52 space-y-2 p-3", META_OVERLAY_Z)} align="start">
                  <p className="text-xs font-medium text-muted-foreground">Prioridade</p>
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
                    <SelectContent className={META_OVERLAY_Z}>
                      {(Object.keys(TAREFA_PRIORIDADE_LABELS) as TarefaPrioridade[]).map((p) => (
                        <SelectItem key={p} value={p}>
                          <span className="flex items-center gap-2">
                            <span
                              className={cn("h-2.5 w-2.5 rounded-full", TAREFA_PRIORIDADE_DOT[p])}
                            />
                            {TAREFA_PRIORIDADE_LABELS[p]}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Lembretes */}
        <FormField
          control={form.control}
          name="lembretes"
          render={({ field }) => (
            <FormItem className="space-y-0">
              <Popover>
                <PopoverTrigger asChild>
                  <span>
                    <MetaIconButton
                      label={
                        lembretes.length
                          ? `Lembretes: ${lembretes.length}`
                          : "Lembretes"
                      }
                      active={lembretes.length > 0}
                      disabled={!canEdit}
                      compact={compact}
                    >
                      <Bell className={iconClass} />
                    </MetaIconButton>
                  </span>
                </PopoverTrigger>
                <PopoverContent className={cn("w-64 space-y-2 p-3", META_OVERLAY_Z)} align="start">
                  <p className="text-xs font-medium text-muted-foreground">Lembretes</p>
                  <div className="space-y-2">
                    {(Object.keys(TAREFA_LEMBRETE_LABELS) as TarefaLembreteOpcao[]).map((opcao) => {
                      const checked = field.value.includes(opcao);
                      return (
                        <label
                          key={opcao}
                          className="flex cursor-pointer items-center gap-2 text-sm"
                        >
                          <Checkbox
                            checked={checked}
                            disabled={!canEdit}
                            onCheckedChange={(v) => {
                              if (v) {
                                field.onChange([...field.value, opcao]);
                              } else {
                                field.onChange(field.value.filter((item) => item !== opcao));
                              }
                            }}
                          />
                          <Label className="cursor-pointer font-normal">
                            {TAREFA_LEMBRETE_LABELS[opcao]}
                          </Label>
                        </label>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </TooltipProvider>
  );
}
