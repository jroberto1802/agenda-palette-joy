import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { useAuth } from "@/hooks/use-auth";
import { profileKeys } from "@/lib/query-keys";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import { clearSenhaTemporaria, updateMinhaSenha } from "@/services/auth-password";
import type { Profile } from "@/types";
import { isSenhaTemporariaExpirada } from "@/utils/permissions";

const schema = z
  .object({
    password: z.string().min(6, "A nova senha deve ter pelo menos 6 caracteres"),
    confirmPassword: z.string().min(6, "Confirme a nova senha"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

/**
 * Tela bloqueante: enquanto a conta estiver com senha temporária,
 * o usuário só pode definir uma nova senha (dentro ou após o prazo de 3 dias).
 */
export function DefinirSenhaObrigatoria({ profile }: { profile: Profile }) {
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const expirada = isSenhaTemporariaExpirada(profile);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const mutation = useMutation({
    mutationFn: async (password: string) => {
      await updateMinhaSenha(password);
      await clearSenhaTemporaria();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: profileKeys.all });
      toast.success("Senha atualizada", {
        description: "Sua nova senha foi definida com sucesso.",
      });
    },
    onError: (error) => {
      toast.error("Erro ao definir senha", {
        description: getSupabaseErrorMessage(error as Error),
      });
    },
  });

  const handleSubmit = form.handleSubmit((values) => {
    mutation.mutate(values.password);
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Definir nova senha</CardTitle>
          <CardDescription>
            {expirada
              ? "O prazo de 3 dias da senha temporária expirou. Defina uma nova senha para continuar acessando o sistema."
              : "Sua conta está com senha temporária. Defina uma nova senha para continuar. Você tem até 3 dias após o reset."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={handleSubmit} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nova senha</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        minLength={6}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar nova senha</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        minLength={6}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={mutation.isPending}>
                {mutation.isPending ? "Salvando..." : "Salvar nova senha"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                disabled={mutation.isPending}
                onClick={() => void signOut()}
              >
                Sair
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
