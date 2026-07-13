import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type {
  AvisoAlcance,
  AvisoFormData,
  AvisoPrioridade,
  AvisoWithRelations,
  ProfileWithSetor,
  SetorWithGerente,
} from "@/types";
import { AVISO_ALCANCE_LABELS, AVISO_PRIORIDADE_LABELS } from "@/utils/avisos";

function defaultExpirationValue(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  date.setSeconds(0, 0);
  return date.toISOString().slice(0, 16);
}

function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const avisoBaseSchema = z.object({
  titulo: z.string().min(2, "Título obrigatório"),
  conteudo: z.string().min(5, "Conteúdo deve ter pelo menos 5 caracteres"),
  alcance: z.enum(["todos", "por_setor", "pessoa_especifica"]),
  prioridade: z.enum(["urgente", "importante", "informativo", "geral"]),
  data_expiracao: z.string().min(1, "Data de expiração obrigatória"),
  fixado: z.boolean(),
  comentarios_permitidos: z.boolean(),
  setor_ids: z.array(z.string()),
  usuario_ids: z.array(z.string()),
});

function createAvisoSchema(requireFutureExpiration: boolean) {
  return avisoBaseSchema.superRefine((data, ctx) => {
    if (requireFutureExpiration && new Date(data.data_expiracao) <= new Date()) {
      ctx.addIssue({
        code: "custom",
        message: "A data de expiração deve ser futura",
        path: ["data_expiracao"],
      });
    }
    if (data.alcance === "por_setor" && data.setor_ids.length === 0) {
      ctx.addIssue({ code: "custom", message: "Selecione ao menos um setor", path: ["setor_ids"] });
    }
    if (data.alcance === "pessoa_especifica" && data.usuario_ids.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Selecione ao menos uma pessoa",
        path: ["usuario_ids"],
      });
    }
  });
}

type AvisoSchema = z.infer<typeof avisoBaseSchema>;

const emptyDefaults: AvisoSchema = {
  titulo: "",
  conteudo: "",
  alcance: "todos",
  prioridade: "geral",
  data_expiracao: defaultExpirationValue(),
  fixado: false,
  comentarios_permitidos: true,
  setor_ids: [],
  usuario_ids: [],
};

function avisoToFormValues(aviso: AvisoWithRelations): AvisoSchema {
  return {
    titulo: aviso.titulo,
    conteudo: aviso.conteudo,
    alcance: aviso.alcance,
    prioridade: aviso.prioridade,
    data_expiracao: toDatetimeLocalValue(aviso.data_expiracao),
    fixado: aviso.fixado,
    comentarios_permitidos: aviso.comentarios_permitidos,
    setor_ids: (aviso.setores ?? [])
      .map((row) => row.setor?.id)
      .filter((id): id is string => !!id),
    usuario_ids: (aviso.pessoas ?? [])
      .map((row) => row.usuario?.id)
      .filter((id): id is string => !!id),
  };
}

export function AvisoFormDialog({
  open,
  onOpenChange,
  aviso,
  setores,
  pessoas,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aviso?: AvisoWithRelations | null;
  setores: SetorWithGerente[];
  pessoas: ProfileWithSetor[];
  onSubmit: (data: AvisoFormData) => Promise<void>;
  loading?: boolean;
}) {
  const isEdit = !!aviso;

  const form = useForm<AvisoSchema>({
    resolver: zodResolver(createAvisoSchema(!isEdit)),
    defaultValues: emptyDefaults,
  });

  const alcance = form.watch("alcance");

  useEffect(() => {
    if (!open) return;
    if (aviso) {
      form.reset(avisoToFormValues(aviso));
      return;
    }
    form.reset({
      ...emptyDefaults,
      data_expiracao: defaultExpirationValue(),
    });
  }, [open, aviso, form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit({
      ...values,
      data_expiracao: new Date(values.data_expiracao).toISOString(),
    });
  });

  const toggleSetor = (id: string, checked: boolean) => {
    const current = form.getValues("setor_ids");
    form.setValue(
      "setor_ids",
      checked ? [...current, id] : current.filter((s) => s !== id),
    );
  };

  const togglePessoa = (id: string, checked: boolean) => {
    const current = form.getValues("usuario_ids");
    form.setValue(
      "usuario_ids",
      checked ? [...current, id] : current.filter((s) => s !== id),
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar aviso" : "Novo aviso"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Atualize as informações do comunicado."
              : "Publique um comunicado para a equipe."}
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
                    <Input placeholder="Ex: Reunião geral na sexta" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="conteudo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Conteúdo</FormLabel>
                  <FormControl>
                    <Textarea rows={5} placeholder="Escreva o aviso..." {...field} />
                  </FormControl>
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
                    onValueChange={(v) => field.onChange(v as AvisoPrioridade)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(Object.keys(AVISO_PRIORIDADE_LABELS) as AvisoPrioridade[]).map((prioridade) => (
                        <SelectItem key={prioridade} value={prioridade}>
                          {AVISO_PRIORIDADE_LABELS[prioridade]}
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
              name="data_expiracao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de expiração</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="alcance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Alcance</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(v) => field.onChange(v as AvisoAlcance)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(Object.keys(AVISO_ALCANCE_LABELS) as AvisoAlcance[]).map((a) => (
                        <SelectItem key={a} value={a}>
                          {AVISO_ALCANCE_LABELS[a]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {alcance === "por_setor" && (
              <FormField
                control={form.control}
                name="setor_ids"
                render={() => (
                  <FormItem>
                    <FormLabel>Setores</FormLabel>
                    <div className="space-y-2 rounded-lg border p-3 max-h-40 overflow-y-auto">
                      {setores.map((s) => (
                        <label key={s.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={form.watch("setor_ids").includes(s.id)}
                            onCheckedChange={(c) => toggleSetor(s.id, !!c)}
                          />
                          {s.nome}
                        </label>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {alcance === "pessoa_especifica" && (
              <FormField
                control={form.control}
                name="usuario_ids"
                render={() => (
                  <FormItem>
                    <FormLabel>Pessoas</FormLabel>
                    <div className="space-y-2 rounded-lg border p-3 max-h-40 overflow-y-auto">
                      {pessoas.map((p) => (
                        <label key={p.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={form.watch("usuario_ids").includes(p.id)}
                            onCheckedChange={(c) => togglePessoa(p.id, !!c)}
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

            <FormField
              control={form.control}
              name="fixado"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <FormLabel>Fixar no topo</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="comentarios_permitidos"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <FormLabel>Permitir comentários</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading
                  ? isEdit
                    ? "Salvando..."
                    : "Publicando..."
                  : isEdit
                    ? "Salvar"
                    : "Publicar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
