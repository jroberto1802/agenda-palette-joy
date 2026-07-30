import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PessoasMultiSelect } from "@/components/common/pessoas-multi-select";
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
import type { RecorrenciaPasta, RecorrenciaPastaFormData } from "@/services/recorrencia-pastas";
import type { ProfileWithSetor } from "@/types";

const pastaSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  descricao: z.string().optional(),
  responsavel_id: z.string().nullable(),
  membro_ids: z.array(z.string()),
});

type PastaSchema = z.infer<typeof pastaSchema>;

function getMembroIds(pasta?: RecorrenciaPasta | null): string[] {
  if (!pasta?.membros?.length) {
    return pasta?.responsavel_id ? [pasta.responsavel_id] : [];
  }
  return pasta.membros.map((m) => m.usuario_id);
}

export function RecorrenciaPastaFormDialog({
  open,
  onOpenChange,
  pasta,
  pessoas,
  onSubmit,
  loading,
  canManageEquipe = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pasta?: RecorrenciaPasta | null;
  pessoas: ProfileWithSetor[];
  onSubmit: (data: RecorrenciaPastaFormData) => Promise<void>;
  loading?: boolean;
  canManageEquipe?: boolean;
}) {
  const form = useForm<PastaSchema>({
    resolver: zodResolver(pastaSchema),
    defaultValues: {
      nome: "",
      descricao: "",
      responsavel_id: null,
      membro_ids: [],
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        nome: pasta?.nome ?? "",
        descricao: pasta?.descricao ?? "",
        responsavel_id: pasta?.responsavel_id ?? null,
        membro_ids: getMembroIds(pasta),
      });
    }
  }, [open, pasta, form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit({
      nome: values.nome,
      descricao: values.descricao,
      responsavel_id: values.responsavel_id,
      membro_ids: values.membro_ids,
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{pasta ? "Editar pasta" : "Nova pasta"}</DialogTitle>
          <DialogDescription>
            {pasta
              ? "Atualize os dados e os participantes da pasta."
              : "Informe nome, descrição, responsável e participantes."}
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
                    <Input placeholder="Ex: Financeiro, Rotinas da equipe…" {...field} />
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
                  <FormLabel>Descrição resumida</FormLabel>
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

            <FormField
              control={form.control}
              name="membro_ids"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Participantes</FormLabel>
                  <FormControl>
                    <PessoasMultiSelect
                      pessoas={pessoas}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Selecione os participantes"
                      showSelectAll
                      disabled={!canManageEquipe}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Participar da pasta organiza as séries, mas não libera o acesso ao modelo.
                    Cada série mantém seus próprios responsáveis e visualizadores.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando..." : pasta ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
