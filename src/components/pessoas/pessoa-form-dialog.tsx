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
import { Switch } from "@/components/ui/switch";
import type { Papel, ProfileWithSetor, SetorWithGerente } from "@/types";
import { PAPEL_LABELS } from "@/utils/permissions";

const profileSchema = z.object({
  nome_completo: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  cargo: z.string(),
  setor_id: z.string().nullable(),
  papel: z.enum(["admin", "gerente", "usuario", "visualizador"]),
  ativo: z.boolean(),
});

type ProfileSchema = z.infer<typeof profileSchema>;

export function PessoaFormDialog({
  open,
  onOpenChange,
  pessoa,
  setores,
  canEditRole,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pessoa: ProfileWithSetor | null;
  setores: SetorWithGerente[];
  canEditRole: boolean;
  onSubmit: (data: ProfileSchema) => Promise<void>;
  loading?: boolean;
}) {
  const form = useForm<ProfileSchema>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      nome_completo: "",
      cargo: "",
      setor_id: null,
      papel: "usuario",
      ativo: true,
    },
  });

  useEffect(() => {
    if (open && pessoa) {
      form.reset({
        nome_completo: pessoa.nome_completo,
        cargo: pessoa.cargo ?? "",
        setor_id: pessoa.setor_id,
        papel: pessoa.papel,
        ativo: pessoa.ativo,
      });
    }
  }, [open, pessoa, form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(values);
  });

  if (!pessoa) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar pessoa</DialogTitle>
          <DialogDescription>Atualize os dados de {pessoa.nome_completo}.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="nome_completo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome completo</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cargo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cargo</FormLabel>
                  <FormControl>
                    <Input placeholder="Opcional" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                        <SelectValue placeholder="Selecione um setor" />
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

            {canEditRole && (
              <>
                <FormField
                  control={form.control}
                  name="papel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Papel</FormLabel>
                      <Select value={field.value} onValueChange={(v) => field.onChange(v as Papel)}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(Object.keys(PAPEL_LABELS) as Papel[]).map((papel) => (
                            <SelectItem key={papel} value={papel}>
                              {PAPEL_LABELS[papel]}
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
                  name="ativo"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <FormLabel>Ativo</FormLabel>
                        <p className="text-xs text-muted-foreground">
                          Usuários inativos não aparecem nas listagens.
                        </p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
