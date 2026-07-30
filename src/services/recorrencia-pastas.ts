import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/types";

/** Slug da pasta padrão (séries sem `recorrencia_pasta_id`). */
export const RECORRENCIA_ENTRADAS_SLUG = "entradas";

// Tabelas novas — tipagem via cast até regenerar Database completo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type RecorrenciaPasta = {
  id: string;
  nome: string;
  descricao: string | null;
  responsavel_id: string | null;
  criado_por: string;
  created_at: string;
  updated_at: string;
  criador?: Pick<Profile, "id" | "nome_completo" | "avatar_url"> | null;
  responsavel?: Pick<Profile, "id" | "nome_completo" | "avatar_url"> | null;
  membros?: {
    usuario_id: string;
    usuario: Pick<Profile, "id" | "nome_completo" | "avatar_url" | "cargo" | "papel"> | null;
  }[];
};

export type RecorrenciaPastaFormData = {
  nome: string;
  descricao?: string;
  responsavel_id: string | null;
  membro_ids: string[];
};

export type RecorrenciaPastaMembro = Pick<
  Profile,
  "id" | "nome_completo" | "avatar_url" | "cargo" | "papel"
>;

const PASTA_SELECT = `
  id, nome, descricao, responsavel_id, criado_por, created_at, updated_at,
  criador:profiles!recorrencia_pastas_criado_por_fkey(id, nome_completo, avatar_url),
  responsavel:profiles!recorrencia_pastas_responsavel_id_fkey(id, nome_completo, avatar_url),
  membros:recorrencia_pasta_membros(
    usuario_id,
    usuario:profiles!recorrencia_pasta_membros_usuario_id_fkey(id, nome_completo, avatar_url, cargo, papel)
  )
`;

export function isRecorrenciaEntradasSlug(pastaId: string | null | undefined): boolean {
  return pastaId === RECORRENCIA_ENTRADAS_SLUG;
}

/** Pasta virtual Entradas (não persiste no banco). */
export function buildEntradasPasta(profileId?: string | null): RecorrenciaPasta {
  return {
    id: RECORRENCIA_ENTRADAS_SLUG,
    nome: "Entradas",
    descricao: "Séries criadas sem escolha de pasta.",
    responsavel_id: null,
    criado_por: profileId ?? "",
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
    criador: null,
    responsavel: null,
    membros: [],
  };
}

export async function listRecorrenciaPastas(search?: string): Promise<RecorrenciaPasta[]> {
  let query = db
    .from("recorrencia_pastas")
    .select(PASTA_SELECT)
    .order("nome", { ascending: true });

  const term = search?.trim();
  if (term) {
    query = query.or(`nome.ilike.%${term}%,descricao.ilike.%${term}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as RecorrenciaPasta[];
}

export async function getRecorrenciaPasta(id: string): Promise<RecorrenciaPasta> {
  if (isRecorrenciaEntradasSlug(id)) {
    return buildEntradasPasta();
  }

  const { data, error } = await db
    .from("recorrencia_pastas")
    .select(PASTA_SELECT)
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as RecorrenciaPasta;
}

export async function listRecorrenciaPastaMembros(
  pastaId: string,
): Promise<RecorrenciaPastaMembro[]> {
  if (isRecorrenciaEntradasSlug(pastaId)) return [];

  const pasta = await getRecorrenciaPasta(pastaId);
  return (pasta.membros ?? [])
    .map((m) => m.usuario)
    .filter((u): u is RecorrenciaPastaMembro => !!u);
}

export async function createRecorrenciaPasta(
  payload: RecorrenciaPastaFormData,
): Promise<RecorrenciaPasta> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  const trimmed = payload.nome.trim();
  if (!trimmed) throw new Error("Informe o nome da pasta.");
  if (trimmed.toLocaleLowerCase("pt-BR") === "entradas") {
    throw new Error('O nome "Entradas" é reservado para a pasta padrão.');
  }

  const id = crypto.randomUUID();
  const { error } = await db.from("recorrencia_pastas").insert({
    id,
    nome: trimmed,
    descricao: payload.descricao?.trim() || null,
    responsavel_id: payload.responsavel_id || null,
    criado_por: user.id,
  });
  if (error) throw error;

  try {
    await setRecorrenciaPastaMembros(id, payload.membro_ids);
  } catch (membrosError) {
    throw new Error(
      `Pasta criada, mas não foi possível salvar os participantes: ${
        membrosError instanceof Error ? membrosError.message : "erro de permissão"
      }`,
    );
  }

  return getRecorrenciaPasta(id);
}

export async function updateRecorrenciaPasta(
  id: string,
  payload: RecorrenciaPastaFormData,
): Promise<RecorrenciaPasta> {
  if (isRecorrenciaEntradasSlug(id)) {
    throw new Error("A pasta Entradas não pode ser editada.");
  }

  const trimmed = payload.nome.trim();
  if (!trimmed) throw new Error("Informe o nome da pasta.");
  if (trimmed.toLocaleLowerCase("pt-BR") === "entradas") {
    throw new Error('O nome "Entradas" é reservado para a pasta padrão.');
  }

  const { error } = await db
    .from("recorrencia_pastas")
    .update({
      nome: trimmed,
      descricao: payload.descricao?.trim() || null,
      responsavel_id: payload.responsavel_id || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;

  await setRecorrenciaPastaMembros(id, payload.membro_ids);
  return getRecorrenciaPasta(id);
}

/** @deprecated Preferir updateRecorrenciaPasta */
export async function renameRecorrenciaPasta(
  id: string,
  nome: string,
): Promise<RecorrenciaPasta> {
  const pasta = await getRecorrenciaPasta(id);
  return updateRecorrenciaPasta(id, {
    nome,
    descricao: pasta.descricao ?? undefined,
    responsavel_id: pasta.responsavel_id,
    membro_ids: (pasta.membros ?? []).map((m) => m.usuario_id),
  });
}

export async function deleteRecorrenciaPasta(id: string): Promise<void> {
  if (isRecorrenciaEntradasSlug(id)) {
    throw new Error("A pasta Entradas não pode ser excluída.");
  }
  const { error } = await db.from("recorrencia_pastas").delete().eq("id", id);
  if (error) throw error;
}

export async function setRecorrenciaPastaMembros(
  pastaId: string,
  usuarioIds: string[],
): Promise<void> {
  if (isRecorrenciaEntradasSlug(pastaId)) {
    throw new Error("A pasta Entradas não possui participantes editáveis.");
  }

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
  const resolved =
    pastaId && !isRecorrenciaEntradasSlug(pastaId) ? pastaId : null;
  const { error } = await supabase
    .from("tarefas")
    .update({ recorrencia_pasta_id: resolved } as never)
    .eq("id", tarefaId);
  if (error) throw error;
}

/**
 * Conta ocorrências abertas das séries (modelos) da pasta.
 * `pastaId` null ou "entradas" = séries sem pasta.
 */
export async function countOcorrenciasAbertasPorPasta(
  pastaId: string | null,
): Promise<number> {
  const isEntradas = !pastaId || isRecorrenciaEntradasSlug(pastaId);

  let modelosQuery = supabase
    .from("tarefas")
    .select("id, serie_raiz_id")
    .is("deleted_at", null)
    .not("recorrencia", "is", null);

  if (isEntradas) {
    modelosQuery = modelosQuery.is("recorrencia_pasta_id", null);
  } else {
    modelosQuery = modelosQuery.eq("recorrencia_pasta_id", pastaId!);
  }

  const { data: rows, error } = await modelosQuery;
  if (error) throw error;

  const modeloIds = (rows ?? [])
    .filter((t) => t.serie_raiz_id === t.id)
    .map((t) => t.id);

  if (modeloIds.length === 0) return 0;

  const { data: abertas, error: countError } = await supabase
    .from("tarefas")
    .select("id, serie_raiz_id")
    .in("serie_raiz_id", modeloIds)
    .eq("concluida", false)
    .is("deleted_at", null);

  if (countError) throw countError;

  return (abertas ?? []).filter((t) => t.id !== t.serie_raiz_id).length;
}

export async function countSeriesPorPasta(): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("tarefas")
    .select("id, serie_raiz_id, recorrencia_pasta_id")
    .is("deleted_at", null)
    .not("recorrencia", "is", null);

  if (error) throw error;

  const map = new Map<string, number>();
  for (const row of data ?? []) {
    if (row.serie_raiz_id !== row.id) continue;
    const key = row.recorrencia_pasta_id ?? RECORRENCIA_ENTRADAS_SLUG;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}
