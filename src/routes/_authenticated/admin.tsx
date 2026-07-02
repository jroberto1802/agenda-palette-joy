import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Shield, UserPlus } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useCriarUsuarioAdmin } from "@/hooks/use-admin";
import { useProfile } from "@/hooks/use-profile";
import { useSetores } from "@/hooks/use-setores";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import type { Papel } from "@/types";
import { isAdmin, PAPEL_LABELS } from "@/utils/permissions";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

const schema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
  nome_completo: z.string().min(2, "Nome obrigatório"),
  papel: z.enum(["admin", "gerente", "usuario", "visualizador"]),
  setor_id: z.string().nullable(),
});

type FormSchema = z.infer<typeof schema>;

function AdminPage() {
  const { data: profile, isLoading: loadingProfile } = useProfile();
  const { data: setores } = useSetores();
  const criarUsuario = useCriarUsuarioAdmin();
  const navigate = useNavigate();

  const form = useForm<FormSchema>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: "",
      nome_completo: "",
      papel: "usuario",
      setor_id: null,
    },
  });

  useEffect(() => {
    if (!loadingProfile && profile && !isAdmin(profile)) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [profile, loadingProfile, navigate]);

  if (loadingProfile || !isAdmin(profile)) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
        Verificando permissões...
      </div>
    );
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await criarUsuario.mutateAsync({
        email: values.email,
        password: values.password,
        nome_completo: values.nome_completo,
        papel: values.papel,
        setor_id: values.setor_id,
      });
      toast.success("Usuário criado com sucesso");
      form.reset();
    } catch (error) {
      toast.error("Erro ao criar usuário", {
        description: getSupabaseErrorMessage(error as Error),
      });
    }
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6" />
          Painel Admin
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestão de usuários via Edge Function segura (service_role).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Criar usuário
          </CardTitle>
          <CardDescription>
            Cria conta no Supabase Auth e perfil vinculado. Requer a Edge Function{" "}
            <code className="text-xs bg-muted px-1 rounded">criar-usuario</code> publicada.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={onSubmit} className="space-y-4">
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
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
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
                    <FormLabel>Senha temporária</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                          {(Object.keys(PAPEL_LABELS) as Papel[]).map((p) => (
                            <SelectItem key={p} value={p}>
                              {PAPEL_LABELS[p]}
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
                          {(setores ?? []).map((s) => (
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
              </div>

              <Button type="submit" disabled={criarUsuario.isPending} className="gap-2">
                <UserPlus className="h-4 w-4" />
                {criarUsuario.isPending ? "Criando..." : "Criar usuário"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deploy da Edge Function</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Para ativar a criação de usuários, publique a function no Supabase:</p>
          <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
            supabase functions deploy criar-usuario
          </pre>
          <p>
            A function usa <code className="text-xs bg-muted px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
            automaticamente no ambiente Supabase — nunca exponha essa chave no frontend.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
