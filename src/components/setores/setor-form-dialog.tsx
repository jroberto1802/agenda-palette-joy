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
import type { SetorFormData, SetorWithGerente } from "@/types";

const setorSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  cor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use um hex válido, ex: #3B82F6"),
  descricao: z.string(),
  gerente_id: z.string().nullable(),
});

type SetorSchema = z.infer<typeof setorSchema>;

type GerenteOption = { id: string; nome_completo: string };

export function SetorFormDialog({
  open,
  onOpenChange,
  setor,
  gerentes,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setor?: SetorWithGerente | null;
  gerentes: GerenteOption[];
  onSubmit: (data: SetorFormData) => Promise<void>;
  loading?: boolean;
}) {
  const form = useForm<SetorSchema>({
    resolver: zodResolver(setorSchema),
    defaultValues: {
      nome: "",
      cor: "#3B82F6",
      descricao: "",
      gerente_id: null,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        nome: setor?.nome ?? "",
        cor: setor?.cor ?? "#3B82F6",
        descricao: setor?.descricao ?? "",
        gerente_id: setor?.gerente_id ?? null,
      });
    }
  }, [open, setor, form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit({
      nome: values.nome,
      cor: values.cor,
      descricao: values.descricao,
      gerente_id: values.gerente_id || null,
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{setor ? "Editar setor" : "Novo setor"}</DialogTitle>
          <DialogDescription>
            {setor
              ? "Atualize as informações do setor."
              : "Crie um setor para organizar pessoas e tarefas."}
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
                    <Input placeholder="Ex: Comercial" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cor</FormLabel>
                  <div className="flex gap-2">
                    <FormControl>
                      <Input type="color" className="w-14 px-1" {...field} />
                    </FormControl>
                    <FormControl>
                      <Input {...field} className="font-mono" spellCheck={false} />
                    </FormControl>
                  </div>
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
                    <Textarea placeholder="Opcional" rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="gerente_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gerente</FormLabel>
                  <Select
                    value={field.value ?? "none"}
                    onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um gerente" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {gerentes.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.nome_completo}
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
                {loading ? "Salvando..." : setor ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
