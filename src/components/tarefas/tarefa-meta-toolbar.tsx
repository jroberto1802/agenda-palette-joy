import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Bell,
  Building2,
  CalendarClock,
  CalendarDays,
  CircleDot,
  Eye,
  FolderKanban,
  RefreshCw,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";
import type { UseFormReturn } from "react-hook-form";
import { PessoasMultiSelect } from "@/components/common/pessoas-multi-select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
  SetorWithGerente,
  TarefaLembreteOpcao,
  TarefaPrioridade,
  TarefaStatus,
  TarefaVisibilidade,
} from "@/types";
import {
  TAREFA_LEMBRETE_LABELS,
  TAREFA_PRIORIDADE_DOT,
  TAREFA_PRIORIDADE_LABELS,
  TAREFA_STATUS_COLORS,
  TAREFA_STATUS_LABELS,
  TAREFA_VISIBILIDADE_LABELS,
  TAREFA_VISIBILIDADE_OPTIONS,
} from "@/utils/tarefas";

/** Acima de Dialog/Sheet (z-50) e do drawer de subtarefa (z-[70]). */
const META_OVERLAY_Z = "z-[100]";

export type TarefaMetaFormValues = {
  projeto_id: string | null;
  setor_id: string | null;
  atribuido_ids: string[];
  visibilidade: TarefaVisibilidade;
  observador_ids: string[];
  data_inicio: Date | null;
  data_vencimento: Date | null;
  prioridade: TarefaPrioridade;
  status: TarefaStatus;
  lembretes: TarefaLembreteOpcao[];
};

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
            "h-9 w-9 shrink-0 rounded-lg text-muted-foreground hover:text-foreground",
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

function DatePopoverBody({
  value,
  onChange,
}: {
  value: Date | null;
  onChange: (date: Date | null) => void;
}) {
  return (
    <>
      <Calendar
        mode="single"
        selected={value ?? undefined}
        onSelect={onChange}
        locale={ptBR}
        initialFocus
      />
      {value && (
        <div className="border-t p-2">
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
    </>
  );
}

export function TarefaMetaToolbar({
  form,
  canEdit,
  canEditVisibility,
  lockProjeto,
  projetos,
  setores,
  pessoasParaResponsavel,
  pessoasAtivas,
  emptyResponsavelLabel,
  requireResponsavel = true,
}: {
  form: UseFormReturn<TarefaMetaFormValues & Record<string, unknown>>;
  canEdit: boolean;
  canEditVisibility: boolean;
  lockProjeto?: boolean;
  projetos: Pick<Projeto, "id" | "nome">[];
  setores: SetorWithGerente[];
  pessoasParaResponsavel: ProfileWithSetor[];
  pessoasAtivas: ProfileWithSetor[];
  emptyResponsavelLabel: string;
  /** Na tarefa principal é obrigatório; subtarefa pode ficar sem responsável. */
  requireResponsavel?: boolean;
}) {
  const projetoId = form.watch("projeto_id");
  const setorId = form.watch("setor_id");
  const atribuidoIds = form.watch("atribuido_ids") ?? [];
  const visibilidade = form.watch("visibilidade");
  const dataInicio = form.watch("data_inicio");
  const dataVencimento = form.watch("data_vencimento");
  const prioridade = form.watch("prioridade");
  const status = form.watch("status");
  const lembretes = form.watch("lembretes") ?? [];

  const projetoNome = projetos.find((p) => p.id === projetoId)?.nome;
  const setorNome = setores.find((s) => s.id === setorId)?.nome;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-wrap items-center gap-1 rounded-xl border bg-muted/30 p-1.5">
        {/* Projeto */}
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
                    >
                      <FolderKanban className="h-4 w-4" />
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

        {/* Setor */}
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
                    >
                      <Building2 className="h-4 w-4" />
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
                      className={
                        requireResponsavel && !atribuidoIds.length
                          ? "text-destructive"
                          : undefined
                      }
                    >
                      <UserRound className="h-4 w-4" />
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
                  />
                  <FormMessage />
                </PopoverContent>
              </Popover>
            </FormItem>
          )}
        />

        {/* Visibilidade */}
        <FormField
          control={form.control}
          name="visibilidade"
          render={({ field }) => (
            <FormItem className="space-y-0">
              <Popover>
                <PopoverTrigger asChild>
                  <span>
                    <MetaIconButton
                      label={`Visibilidade: ${TAREFA_VISIBILIDADE_LABELS[field.value]}`}
                      active={field.value !== "somente_para_mim"}
                      disabled={!canEditVisibility}
                    >
                      <Eye className="h-4 w-4" />
                    </MetaIconButton>
                  </span>
                </PopoverTrigger>
                <PopoverContent className={cn("w-80 space-y-3 p-3", META_OVERLAY_Z)} align="start">
                  <p className="text-xs font-medium text-muted-foreground">Visibilidade</p>
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
                    <SelectContent className={META_OVERLAY_Z}>
                      {TAREFA_VISIBILIDADE_OPTIONS.map((value) => (
                        <SelectItem key={value} value={value}>
                          {TAREFA_VISIBILIDADE_LABELS[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {visibilidade === "pessoas_especificas" && (
                    <FormField
                      control={form.control}
                      name="observador_ids"
                      render={({ field: obsField }) => (
                        <FormItem className="space-y-2">
                          <p className="text-xs text-muted-foreground">Pessoas com acesso</p>
                          <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                            {pessoasAtivas.map((pessoa) => {
                              const checked = obsField.value.includes(pessoa.id);
                              return (
                                <label
                                  key={pessoa.id}
                                  className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-muted/50"
                                >
                                  <Checkbox
                                    checked={checked}
                                    disabled={!canEditVisibility}
                                    onCheckedChange={(v) => {
                                      if (v) {
                                        obsField.onChange([...obsField.value, pessoa.id]);
                                      } else {
                                        obsField.onChange(
                                          obsField.value.filter((id) => id !== pessoa.id),
                                        );
                                      }
                                    }}
                                  />
                                  <span className="truncate">{pessoa.nome_completo}</span>
                                </label>
                              );
                            })}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <FormMessage />
                </PopoverContent>
              </Popover>
            </FormItem>
          )}
        />

        {/* Data (início) */}
        <FormField
          control={form.control}
          name="data_inicio"
          render={({ field }) => (
            <FormItem className="space-y-0">
              <Popover>
                <PopoverTrigger asChild>
                  <span>
                    <MetaIconButton
                      label={
                        dataInicio
                          ? `Data: ${format(dataInicio, "dd/MM/yyyy", { locale: ptBR })}`
                          : "Data"
                      }
                      active={!!dataInicio}
                      disabled={!canEdit}
                    >
                      <CalendarDays className="h-4 w-4" />
                    </MetaIconButton>
                  </span>
                </PopoverTrigger>
                <PopoverContent className={cn("w-auto p-0", META_OVERLAY_Z)} align="start">
                  <DatePopoverBody value={field.value} onChange={field.onChange} />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Prazo */}
        <FormField
          control={form.control}
          name="data_vencimento"
          render={({ field }) => (
            <FormItem className="space-y-0">
              <Popover>
                <PopoverTrigger asChild>
                  <span>
                    <MetaIconButton
                      label={
                        dataVencimento
                          ? `Prazo: ${format(dataVencimento, "dd/MM/yyyy", { locale: ptBR })}`
                          : "Prazo"
                      }
                      active={!!dataVencimento}
                      disabled={!canEdit}
                    >
                      <CalendarClock className="h-4 w-4" />
                    </MetaIconButton>
                  </span>
                </PopoverTrigger>
                <PopoverContent className={cn("w-auto p-0", META_OVERLAY_Z)} align="start">
                  <DatePopoverBody value={field.value} onChange={field.onChange} />
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
                    >
                      <span
                        className={cn(
                          "h-3.5 w-3.5 rounded-full",
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

        {/* Status */}
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem className="space-y-0">
              <Popover>
                <PopoverTrigger asChild>
                  <span>
                    <MetaIconButton
                      label={`Status: ${TAREFA_STATUS_LABELS[status]}`}
                      active
                      disabled={!canEdit}
                      className={cn(TAREFA_STATUS_COLORS[status])}
                    >
                      <CircleDot className="h-4 w-4" />
                    </MetaIconButton>
                  </span>
                </PopoverTrigger>
                <PopoverContent className={cn("w-56 space-y-2 p-3", META_OVERLAY_Z)} align="start">
                  <p className="text-xs font-medium text-muted-foreground">Status</p>
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
                    <SelectContent className={META_OVERLAY_Z}>
                      {(Object.keys(TAREFA_STATUS_LABELS) as TarefaStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>
                          {TAREFA_STATUS_LABELS[s]}
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
                    >
                      <Bell className="h-4 w-4" />
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

        {/* Recorrência (stub) */}
        <Popover>
          <PopoverTrigger asChild>
            <span>
              <MetaIconButton label="Recorrência" disabled={!canEdit}>
                <RefreshCw className="h-4 w-4" />
              </MetaIconButton>
            </span>
          </PopoverTrigger>
          <PopoverContent className={cn("w-64 p-3", META_OVERLAY_Z)} align="start">
            <p className="text-sm font-medium">Recorrência</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Funcionalidade disponível em breve.
            </p>
          </PopoverContent>
        </Popover>
      </div>
    </TooltipProvider>
  );
}
