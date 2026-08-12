import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ProfileAvatar } from "@/components/common/profile-avatar";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Papel, ProfileFormData, ProfileWithSetor, SetorWithGerente } from "@/types";
import { PAPEL_LABELS, PAPEIS_CADASTRO } from "@/utils/permissions";

const baseSchema = z.object({
  nome_completo: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  password: z.string().optional().or(z.literal("")),
  setor_id: z.string().nullable(),
  papel: z.enum(["admin", "gerente", "usuario", "visualizador"]),
  gestor_id: z.string().nullable(),
  ativo: z.boolean(),
});

type PessoaSchema = z.infer<typeof baseSchema>;

type GestorOption = { id: string; nome_completo: string; papel: Papel };

export function PessoaFormDialog({
  open,
  onOpenChange,
  pessoa,
  setores,
  gestores,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pessoa?: ProfileWithSetor | null;
  setores: SetorWithGerente[];
  gestores: GestorOption[];
  onSubmit: (data: ProfileFormData) => Promise<void>;
  loading?: boolean;
}) {
  const isCreate = !pessoa;
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const form = useForm<PessoaSchema>({
    resolver: zodResolver(
      isCreate
        ? baseSchema.extend({
            email: z.string().email("E-mail inválido"),
            password: z.string().min(6, "Senha provisória deve ter pelo menos 6 caracteres"),
            papel: z.enum(["admin", "gerente", "usuario"]),
          })
        : baseSchema,
    ),
    defaultValues: {
      nome_completo: "",
      email: "",
      password: "",
      setor_id: null,
      papel: "usuario",
      gestor_id: null,
      ativo: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    setAvatarFile(null);
    if (pessoa) {
      setAvatarPreview(pessoa.avatar_url ?? null);
      form.reset({
        nome_completo: pessoa.nome_completo,
        email: pessoa.email ?? "",
        password: "",
        setor_id: pessoa.setor_id,
        papel: pessoa.papel,
        gestor_id: pessoa.gestor_id,
        ativo: pessoa.ativo,
      });
    } else {
      setAvatarPreview(null);
      form.reset({
        nome_completo: "",
        email: "",
        password: "",
        setor_id: null,
        papel: "usuario",
        gestor_id: null,
        ativo: true,
      });
    }
  }, [open, pessoa, form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit({
      nome_completo: values.nome_completo,
      email: values.email || undefined,
      password: values.password || undefined,
      setor_id: values.setor_id,
      papel: values.papel,
      gestor_id: values.gestor_id,
      ativo: values.ativo,
      avatar_file: avatarFile,
    });
  });

  const gestoresFiltrados = gestores.filter((g) => !pessoa || g.id !== pessoa.id);
  const previewName = useMemo(
    () => form.watch("nome_completo") || pessoa?.nome_completo || "Pessoa",
    [form, pessoa?.nome_completo],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isCreate ? "Nova pessoa" : "Editar pessoa"}</DialogTitle>
          <DialogDescription>
            {isCreate
              ? "Cadastre uma pessoa com setor, papel e gestor responsável."
              : `Atualize os dados de ${pessoa?.nome_completo}.`}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <ProfileAvatar
                name={previewName}
                avatarUrl={avatarPreview}
                className="h-20 w-20"
                fallbackClassName="text-lg"
              />
              <div className="flex-1 space-y-2">
                <Label htmlFor="avatar_file">Foto de perfil</Label>
                <Input
                  id="avatar_file"
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setAvatarFile(file);
                    if (file) {
                      setAvatarPreview(URL.createObjectURL(file));
                    } else {
                      setAvatarPreview(pessoa?.avatar_url ?? null);
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Use uma imagem quadrada para melhor resultado no avatar.
                </p>
              </div>
            </div>

            <FormField
              control={form.control}
              name="nome_completo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome completo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isCreate && (
              <>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@empresa.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha provisória</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Mínimo 6 caracteres" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {!isCreate && pessoa?.email && (
              <div className="space-y-1">
                <p className="text-sm font-medium">E-mail</p>
                <p className="text-sm text-muted-foreground">{pessoa.email}</p>
              </div>
            )}

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
                      {PAPEIS_CADASTRO.map((papel) => (
                        <SelectItem key={papel} value={papel}>
                          {PAPEL_LABELS[papel]}
                        </SelectItem>
                      ))}
                      {!isCreate && pessoa?.papel === "visualizador" && (
                        <SelectItem value="visualizador">
                          {PAPEL_LABELS.visualizador}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="gestor_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gestor responsável</FormLabel>
                  <Select
                    value={field.value ?? "none"}
                    onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um gestor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {gestoresFiltrados.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.nome_completo} ({PAPEL_LABELS[g.papel]})
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
                {loading ? "Salvando..." : isCreate ? "Criar" : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
