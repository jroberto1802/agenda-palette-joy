import { supabase } from "@/integrations/supabase/client";
import type { Notificacao } from "@/types";
import type { NotificacaoMeta } from "@/utils/notificacoes";

export async function listNotificacoes(limit = 30): Promise<Notificacao[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  const { data, error } = await supabase
    .from("notificacoes")
    .select("*")
    .eq("usuario_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as Notificacao[];
}

export async function countNotificacoesNaoLidas(): Promise<number> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from("notificacoes")
    .select("id", { count: "exact", head: true })
    .eq("usuario_id", user.id)
    .eq("lida", false);

  if (error) throw error;
  return count ?? 0;
}

export async function markNotificacaoLida(id: string): Promise<void> {
  const { error } = await supabase.from("notificacoes").update({ lida: true }).eq("id", id);
  if (error) throw error;
}

export async function markAllNotificacoesLidas(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  const { error } = await supabase
    .from("notificacoes")
    .update({ lida: true })
    .eq("usuario_id", user.id)
    .eq("lida", false);

  if (error) throw error;
}

export async function notifyUser(params: {
  usuario_id: string;
  tipo: string;
  referencia_tipo?: string | null;
  referencia_id?: string | null;
  mensagem?: string | null;
  meta?: NotificacaoMeta | Record<string, unknown> | null;
}): Promise<void> {
  const { error } = await supabase.rpc("notify_user", {
    p_usuario_id: params.usuario_id,
    p_tipo: params.tipo,
    p_referencia_tipo: params.referencia_tipo ?? null,
    p_referencia_id: params.referencia_id ?? null,
    p_mensagem: params.mensagem ?? null,
    p_meta: params.meta ?? {},
  });

  if (error) throw error;
}

export async function notifyUsers(
  usuarioIds: string[],
  params: Omit<Parameters<typeof notifyUser>[0], "usuario_id">,
): Promise<void> {
  const unique = [...new Set(usuarioIds.filter(Boolean))];
  await Promise.all(
    unique.map((usuario_id) =>
      notifyUser({ usuario_id, ...params }).catch(() => {
        /* ignora falhas individuais de permissão */
      }),
    ),
  );
}
