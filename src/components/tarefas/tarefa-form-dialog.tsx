import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  ProfileWithSetor,
  RecorrenciaConfig,
  RecorrenciaTipo,
  SetorWithGerente,
  TarefaFormData,
  TarefaPrioridade,
  TarefaStatus,
  TarefaWithRelations,
} from "@/types";
import { TAREFA_PRIORIDADE_LABELS, TAREFA_STATUS_LABELS } from "@/utils/tarefas";
import { parseRecorrencia } from "@/utils/recorrencia";
import { TarefaRecorrenciaFields } from "@/components/tarefas/tarefa-recorrencia-fields";

const tarefaSchema = z.object({
  titulo: z.string().min(2, "Título deve ter pelo menos 2 caracteres"),
  descricao: z.string(),
  setor_id: z.string().nullable(),
  atribuido_a: z.string().nullable(),
  prioridade: z.enum(["P1", "P2", "P3", "P4"]),
  status: z.enum(["a_fazer", "em_andamento", "bloqueada", "concluida"]),
  data_vencimento: z.date().nullable(),
  tagsInput: z.string(),
  recorrencia_tipo: z.enum(["nenhuma", "diaria", "semanal", "mensal"]),
  recorrencia_dias_semana: z.array(z.number()),
  recorrencia_dia_mes: z.number().min(1).max(28),
  recorrencia_data_fim: z.date().nullable(),
});

type TarefaSchema = z.infer<typeof tarefaSchema>;

function parseTags(input: string): string[] {
  return input
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function toFormValues(tarefa?: TarefaWithRelations | null): TarefaSchema {
  const rec = parseRecorrencia(tarefa?.recorrencia);
  return {
    titulo: tarefa?.titulo ?? "",
    descricao: tarefa?.descricao ?? "",
    setor_id: tarefa?.setor_id ?? null,
    atribuido_a: tarefa?.atribuido_a ?? null,
    prioridade: tarefa?.prioridade ?? "P4",
    status: tarefa?.status ?? "a_fazer",
    data_vencimento: tarefa?.data_vencimento ? new Date(tarefa.data_vencimento) : null,
    tagsInput: tarefa?.tags?.join(", ") ?? "",
    recorrencia_tipo: rec?.tipo ?? "nenhuma",
    recorrencia_dias_semana: rec?.dias_semana ?? [],
    recorrencia_dia_mes: rec?.dia_mes ?? 1,
    recorrencia_data_fim: rec?.data_fim ? new Date(rec.data_fim) : null,
  };
}

function toRecorrenciaPayload(values: TarefaSchema): RecorrenciaConfig | null {
  if (values.recorrencia_tipo === "nenhuma") return null;
  return {
    tipo: values.recorrencia_tipo as RecorrenciaTipo,
    dias_semana:
      values.recorrencia_tipo === "semanal" ? values.recorrencia_dias_semana : undefined,
    dia_mes: values.recorrencia_tipo === "mensal" ? values.recorrencia_dia_mes : undefined,
    data_fim: values.recorrencia_data_fim ? values.recorrencia_data_fim.toISOString() : null,
  };
}

function toPayload(values: TarefaSchema): TarefaFormData {
  return {
    titulo: values.titulo,
    descricao: values.descricao,
    setor_id: values.setor_id,
    atribuido_a: values.atribuido_a,
    prioridade: values.prioridade,
    status: values.status,
    data_vencimento: values.data_vencimento ? values.data_vencimento.toISOString() : null,
    tags: parseTags(values.tagsInput),
    recorrencia: toRecorrenciaPayload(values),
  };
}

export function TarefaFormDialog({
  open,
  onOpenChange,
  tarefa,
  setores,
  pessoas,
  defaultSetorId,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tarefa?: TarefaWithRelations | null;
  setores: SetorWithGerente[];
  pessoas: ProfileWithSetor[];
  defaultSetorId?: string | null;
  onSubmit: (data: TarefaFormData) => Promise<void>;
  loading?: boolean;
}) {
  const form = useForm<TarefaSchema>({
    resolver: zodResolver(tarefaSchema),
    defaultValues: toFormValues(),
  });

  useEffect(() => {
    if (open) {
      const values = toFormValues(tarefa);
      if (!tarefa && defaultSetorId) {
        values.setor_id = defaultSetorId;
      }
      form.reset(values);
    }
  }, [open, tarefa, defaultSetorId, form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(toPayload(values));
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tarefa ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
          <DialogDescription>
            {tarefa
              ? "Atualize os dados da tarefa."
              : "Crie uma tarefa e atribua a um responsável."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="titulo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Revisar proposta comercial" {...field} />
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
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Detalhes opcionais" rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="setor_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Setor</FormLabel>
                    <Select
                      value={field.value ?? "none"}
                      onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Setor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {setores.map((s) => (
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

              <FormField
                control={form.control}
                name="atribuido_a"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Responsável</FormLabel>
                    <Select
                      value={field.value ?? "none"}
                      onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Responsável" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Ninguém</SelectItem>
                        {pessoas.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nome_completo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="prioridade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prioridade</FormLabel>
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
                        {(Object.keys(TAREFA_PRIORIDADE_LABELS) as TarefaPrioridade[]).map((p) => (
                          <SelectItem key={p} value={p}>
                            {TAREFA_PRIORIDADE_LABELS[p]}
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
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
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
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="data_vencimento"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Vencimento</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground",
                          )}
                        >
                          {field.value
                            ? format(field.value, "dd/MM/yyyy", { locale: ptBR })
                            : "Sem data"}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
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
                        <div className="p-2 border-t">
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
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tagsInput"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags</FormLabel>
                  <FormControl>
                    <Input placeholder="urgente, cliente-x (separadas por vírgula)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <TarefaRecorrenciaFields form={form} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando..." : tarefa ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
