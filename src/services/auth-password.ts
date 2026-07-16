import { supabase } from "@/integrations/supabase/client";

/** Atualiza a senha do usuário autenticado no Auth. */
export async function updateMinhaSenha(password: string): Promise<void> {
  if (!password || password.length < 6) {
    throw new Error("A nova senha deve ter pelo menos 6 caracteres.");
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

/** Remove a flag de senha temporária do próprio perfil. */
export async function clearSenhaTemporaria(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  const { error } = await supabase
    .from("profiles")
    .update({
      senha_temporaria: false,
      senha_temporaria_expira_em: null,
    })
    .eq("id", user.id);

  if (error) throw error;
}
