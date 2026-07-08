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
import type { SetorFormData, SetorWithGerente } from "@/types";

const setorSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  cor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use um hex válido, ex: #3B82F6"),
});

type SetorSchema = z.infer<typeof setorSchema>;

export function SetorFormDialog({
  open,
  onOpenChange,
  setor,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setor?: SetorWithGerente | null;
  onSubmit: (data: SetorFormData) => Promise<void>;
  loading?: boolean;
}) {
  const form = useForm<SetorSchema>({
    resolver: zodResolver(setorSchema),
    defaultValues: {
      nome: "",
      cor: "#3B82F6",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        nome: setor?.nome ?? "",
        cor: setor?.cor ?? "#3B82F6",
      });
    }
  }, [open, setor, form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit({
      nome: values.nome,
      cor: values.cor,
      descricao: setor?.descricao ?? "",
      gerente_id: setor?.gerente_id ?? null,
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{setor ? "Editar setor" : "Novo setor"}</DialogTitle>
          <DialogDescription>
            {setor
              ? "Atualize o nome e a cor do setor."
              : "Informe o nome e a cor do setor."}
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
