import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/types";

// Tabelas novas — tipagem via cast até regenerar Database completo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type RecorrenciaPasta = {
  id: string;
  nome: string;
  criado_por: string;
  created_at: string;
  updated_at: string;
  criador?: Pick<Profile, "id" | "nome_completo" | "avatar_url"> | null;
  membros?: {
    usuario_id: string;
    usuario: Pick<Profile, "id" | "nome_completo" | "avatar_url"> | null;
  }[];
};

const PASTA_SELECT = `
  id, nome, criado_por, created_at, updated_at,
  criador:profiles!recorrencia_pastas_criado_por_fkey(id, nome_completo, avatar_url),
  membros:recorrencia_pasta_membros(
    usuario_id,
    usuario:profiles!recorrencia_pasta_membros_usuario_id_fkey(id, nome_completo, avatar_url)
  )
`;

export async function listRecorrenciaPastas(): Promise<RecorrenciaPasta[]> {
  const { data, error } = await db
    .from("recorrencia_pastas")
    .select(PASTA_SELECT)
    .order("nome", { ascending: true });
  if (error) throw error;
  return (data ?? []) as RecorrenciaPasta[];
}

export async function createRecorrenciaPasta(nome: string): Promise<RecorrenciaPasta> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  const trimmed = nome.trim();
  if (!trimmed) throw new Error("Informe o nome da pasta.");

  const { data, error } = await db
    .from("recorrencia_pastas")
    .insert({ nome: trimmed, criado_por: user.id })
    .select(PASTA_SELECT)
    .single();
  if (error) throw error;
  return data as RecorrenciaPasta;
}

export async function renameRecorrenciaPasta(
  id: string,
  nome: string,
): Promise<RecorrenciaPasta> {
  const trimmed = nome.trim();
  if (!trimmed) throw new Error("Informe o nome da pasta.");

  const { data, error } = await db
    .from("recorrencia_pastas")
    .update({ nome: trimmed, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(PASTA_SELECT)
    .single();
  if (error) throw error;
  return data as RecorrenciaPasta;
}

export async function deleteRecorrenciaPasta(id: string): Promise<void> {
  const { error } = await db.from("recorrencia_pastas").delete().eq("id", id);
  if (error) throw error;
}

export async function setRecorrenciaPastaMembros(
  pastaId: string,
  usuarioIds: string[],
): Promise<void> {
  const unique = [...new Set(usuarioIds.filter(Boolean))];
  const { data: atuais, error: listError } = await db
    .from("recorrencia_pasta_membros")
    .select("usuario_id")
    .eq("pasta_id", pastaId);
  if (listError) throw listError;

  const atualSet = new Set(
    ((atuais ?? []) as { usuario_id: string }[]).map((r) => r.usuario_id),
  );
  const nextSet = new Set(unique);
  const toAdd = unique.filter((id) => !atualSet.has(id));
  const toRemove = [...atualSet].filter((id) => !nextSet.has(id));

  if (toRemove.length > 0) {
    const { error } = await db
      .from("recorrencia_pasta_membros")
      .delete()
      .eq("pasta_id", pastaId)
      .in("usuario_id", toRemove);
    if (error) throw error;
  }

  if (toAdd.length > 0) {
    const { error } = await db.from("recorrencia_pasta_membros").insert(
      toAdd.map((usuario_id) => ({ pasta_id: pastaId, usuario_id })),
    );
    if (error) throw error;
  }
}

export async function moveSerieParaPasta(
  tarefaId: string,
  pastaId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("tarefas")
    .update({ recorrencia_pasta_id: pastaId } as never)
    .eq("id", tarefaId);
  if (error) throw error;
}
