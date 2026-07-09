import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ProfileWithSetor, ProjetoFormData, ProjetoStatus, ProjetoWithResponsavel } from "@/types";
import { PROJETO_STATUS_LABELS } from "@/utils/projetos";

const projetoSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  descricao: z.string().optional(),
  responsavel_id: z.string().nullable(),
  data_inicio: z.string().optional(),
  data_termino_prevista: z.string().optional(),
  status: z.enum(["nao_iniciado", "em_andamento", "concluido", "cancelado"]),
});

type ProjetoSchema = z.infer<typeof projetoSchema>;

function toDateInput(value?: string | null): string {
  if (!value) return "";
  return value.slice(0, 10);
}

export function ProjetoFormDialog({
  open,
  onOpenChange,
  projeto,
  pessoas,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projeto?: ProjetoWithResponsavel | null;
  pessoas: ProfileWithSetor[];
  onSubmit: (data: ProjetoFormData) => Promise<void>;
  loading?: boolean;
}) {
  const form = useForm<ProjetoSchema>({
    resolver: zodResolver(projetoSchema),
    defaultValues: {
      nome: "",
      descricao: "",
      responsavel_id: null,
      data_inicio: "",
      data_termino_prevista: "",
      status: "nao_iniciado",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        nome: projeto?.nome ?? "",
        descricao: projeto?.descricao ?? "",
        responsavel_id: projeto?.responsavel_id ?? null,
        data_inicio: toDateInput(projeto?.data_inicio),
        data_termino_prevista: toDateInput(projeto?.data_termino_prevista),
        status: projeto?.status ?? "nao_iniciado",
      });
    }
  }, [open, projeto, form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit({
      nome: values.nome,
      descricao: values.descricao,
      responsavel_id: values.responsavel_id,
      data_inicio: values.data_inicio ? new Date(values.data_inicio).toISOString() : null,
      data_termino_prevista: values.data_termino_prevista
        ? new Date(values.data_termino_prevista).toISOString()
        : null,
      status: values.status,
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{projeto ? "Editar projeto" : "Novo projeto"}</DialogTitle>
          <DialogDescription>
            {projeto
              ? "Atualize os dados do projeto."
              : "Informe os dados para criar um novo projeto."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Implantação CRM" {...field} />
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
                    <Textarea rows={3} placeholder="Descrição opcional..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="responsavel_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Responsável</FormLabel>
                  <Select
                    value={field.value ?? "none"}
                    onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma pessoa" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {pessoas.map((pessoa) => (
                        <SelectItem key={pessoa.id} value={pessoa.id}>
                          {pessoa.nome_completo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="data_inicio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de início</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="data_termino_prevista"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de término prevista</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(v) => field.onChange(v as ProjetoStatus)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(Object.keys(PROJETO_STATUS_LABELS) as ProjetoStatus[]).map((status) => (
                        <SelectItem key={status} value={status}>
                          {PROJETO_STATUS_LABELS[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando..." : projeto ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
