import { supabase } from "@/integrations/supabase/client";

export const COLUNA_INBOX_NOME = "A organizar";

export type TarefaBoardColuna = {
  id: string;
  usuario_id: string;
  nome: string;
  posicao: number;
  is_inbox: boolean;
  created_at: string;
  updated_at: string;
};

export type TarefaBoardItem = {
  usuario_id: string;
  tarefa_id: string;
  coluna_id: string;
  posicao_coluna: number;
  posicao_lista: number;
};

async function requireUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");
  return user.id;
}

/** Garante coluna inbox e retorna todas as colunas do usuário. */
export async function ensureTarefaBoardColunas(): Promise<TarefaBoardColuna[]> {
  const usuarioId = await requireUserId();

  const { data: existing, error } = await supabase
    .from("tarefa_board_colunas")
    .select("*")
    .eq("usuario_id", usuarioId)
    .order("posicao", { ascending: true });

  if (error) throw error;

  const hasInbox = (existing ?? []).some((c) => c.is_inbox);
  if (!hasInbox) {
    const { error: insertError } = await supabase.from("tarefa_board_colunas").insert({
      usuario_id: usuarioId,
      nome: COLUNA_INBOX_NOME,
      posicao: 0,
      is_inbox: true,
    });
    if (insertError) throw insertError;

    const { data: again, error: reloadError } = await supabase
      .from("tarefa_board_colunas")
      .select("*")
      .eq("usuario_id", usuarioId)
      .order("posicao", { ascending: true });
    if (reloadError) throw reloadError;
    return (again ?? []) as TarefaBoardColuna[];
  }

  return (existing ?? []) as TarefaBoardColuna[];
}

export async function listTarefaBoardItens(): Promise<TarefaBoardItem[]> {
  const usuarioId = await requireUserId();
  const { data, error } = await supabase
    .from("tarefa_board_itens")
    .select("*")
    .eq("usuario_id", usuarioId);
  if (error) throw error;
  return (data ?? []) as TarefaBoardItem[];
}

/**
 * Garante que cada tarefa listada tenha um item no board (vai para a inbox).
 * Retorna mapa tarefa_id → item.
 */
export async function syncTarefaBoardItens(
  tarefaIds: string[],
): Promise<Map<string, TarefaBoardItem>> {
  const usuarioId = await requireUserId();
  const colunas = await ensureTarefaBoardColunas();
  const inbox = colunas.find((c) => c.is_inbox);
  if (!inbox) throw new Error("Coluna padrão não encontrada");

  const itens = await listTarefaBoardItens();
  const byTarefa = new Map(itens.map((i) => [i.tarefa_id, i]));
  const missing = tarefaIds.filter((id) => !byTarefa.has(id));

  if (missing.length > 0) {
    const maxLista = itens.reduce((m, i) => Math.max(m, i.posicao_lista), -1);
    const maxColuna = itens
      .filter((i) => i.coluna_id === inbox.id)
      .reduce((m, i) => Math.max(m, i.posicao_coluna), -1);

    const rows = missing.map((tarefa_id, index) => ({
      usuario_id: usuarioId,
      tarefa_id,
      coluna_id: inbox.id,
      posicao_coluna: maxColuna + 1 + index,
      posicao_lista: maxLista + 1 + index,
    }));

    const { data: inserted, error } = await supabase
      .from("tarefa_board_itens")
      .upsert(rows, { onConflict: "usuario_id,tarefa_id" })
      .select("*");
    if (error) throw error;
    for (const row of inserted ?? []) {
      byTarefa.set(row.tarefa_id, row as TarefaBoardItem);
    }
  }

  return byTarefa;
}

export async function createTarefaBoardColuna(nome: string): Promise<TarefaBoardColuna> {
  const usuarioId = await requireUserId();
  const trimmed = nome.trim();
  if (!trimmed) throw new Error("Informe um nome para a coluna.");

  const colunas = await ensureTarefaBoardColunas();
  const maxPos = colunas.reduce((m, c) => Math.max(m, c.posicao), -1);

  const { data, error } = await supabase
    .from("tarefa_board_colunas")
    .insert({
      usuario_id: usuarioId,
      nome: trimmed,
      posicao: maxPos + 1,
      is_inbox: false,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as TarefaBoardColuna;
}

export async function renameTarefaBoardColuna(
  id: string,
  nome: string,
): Promise<TarefaBoardColuna> {
  const trimmed = nome.trim();
  if (!trimmed) throw new Error("Informe um nome para a coluna.");

  const { data, error } = await supabase
    .from("tarefa_board_colunas")
    .update({ nome: trimmed })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as TarefaBoardColuna;
}

/** Persiste a ordem visual das colunas do usuário (posições 0..n-1). */
export async function reorderTarefaBoardColunas(orderedColunaIds: string[]): Promise<void> {
  const usuarioId = await requireUserId();
  const unique = [...new Set(orderedColunaIds.filter(Boolean))];
  if (unique.length === 0) return;

  const updates = unique.map((id, index) =>
    supabase
      .from("tarefa_board_colunas")
      .update({ posicao: index })
      .eq("id", id)
      .eq("usuario_id", usuarioId),
  );

  const results = await Promise.all(updates);
  const firstError = results.find((r) => r.error)?.error;
  if (firstError) throw firstError;
}

export async function deleteTarefaBoardColuna(id: string): Promise<void> {
  const usuarioId = await requireUserId();
  const colunas = await ensureTarefaBoardColunas();
  const target = colunas.find((c) => c.id === id);
  if (!target) throw new Error("Coluna não encontrada.");
  if (target.is_inbox) throw new Error("A coluna padrão não pode ser excluída.");

  const inbox = colunas.find((c) => c.is_inbox);
  if (!inbox) throw new Error("Coluna padrão não encontrada.");

  const { data: itens, error: listError } = await supabase
    .from("tarefa_board_itens")
    .select("*")
    .eq("usuario_id", usuarioId)
    .eq("coluna_id", id);
  if (listError) throw listError;

  if ((itens ?? []).length > 0) {
    const { data: inboxItens } = await supabase
      .from("tarefa_board_itens")
      .select("posicao_coluna")
      .eq("usuario_id", usuarioId)
      .eq("coluna_id", inbox.id);
    const maxPos = (inboxItens ?? []).reduce(
      (m, i) => Math.max(m, i.posicao_coluna),
      -1,
    );

    const updates = (itens ?? []).map((item, index) => ({
      usuario_id: usuarioId,
      tarefa_id: item.tarefa_id,
      coluna_id: inbox.id,
      posicao_coluna: maxPos + 1 + index,
      posicao_lista: item.posicao_lista,
    }));

    const { error: moveError } = await supabase
      .from("tarefa_board_itens")
      .upsert(updates, { onConflict: "usuario_id,tarefa_id" });
    if (moveError) throw moveError;
  }

  const { error } = await supabase.from("tarefa_board_colunas").delete().eq("id", id);
  if (error) throw error;
}

export async function moveTarefaEntreColunas(params: {
  tarefaId: string;
  colunaId: string;
  /** Nova ordem dentro da coluna de destino (0-based). */
  posicaoColuna: number;
  orderedTarefaIdsInColumn: string[];
}): Promise<void> {
  const usuarioId = await requireUserId();
  const rows = params.orderedTarefaIdsInColumn.map((tarefa_id, index) => ({
    usuario_id: usuarioId,
    tarefa_id,
    coluna_id: params.colunaId,
    posicao_coluna: index,
  }));

  // Preserve posicao_lista: fetch current then merge
  const { data: current, error: curError } = await supabase
    .from("tarefa_board_itens")
    .select("tarefa_id, posicao_lista")
    .eq("usuario_id", usuarioId)
    .in("tarefa_id", params.orderedTarefaIdsInColumn);
  if (curError) throw curError;

  const listaMap = new Map((current ?? []).map((r) => [r.tarefa_id, r.posicao_lista]));
  const payload = rows.map((r) => ({
    ...r,
    posicao_lista: listaMap.get(r.tarefa_id) ?? r.posicao_coluna,
  }));

  const { error } = await supabase
    .from("tarefa_board_itens")
    .upsert(payload, { onConflict: "usuario_id,tarefa_id" });
  if (error) throw error;

  // Reindex remaining in source columns handled by caller refreshing ordered ids for both columns
}

export async function reorderTarefasNaColuna(params: {
  colunaId: string;
  orderedTarefaIds: string[];
}): Promise<void> {
  const usuarioId = await requireUserId();
  const { data: current, error: curError } = await supabase
    .from("tarefa_board_itens")
    .select("tarefa_id, posicao_lista")
    .eq("usuario_id", usuarioId)
    .in("tarefa_id", params.orderedTarefaIds);
  if (curError) throw curError;
  const listaMap = new Map((current ?? []).map((r) => [r.tarefa_id, r.posicao_lista]));

  const payload = params.orderedTarefaIds.map((tarefa_id, index) => ({
    usuario_id: usuarioId,
    tarefa_id,
    coluna_id: params.colunaId,
    posicao_coluna: index,
    posicao_lista: listaMap.get(tarefa_id) ?? index,
  }));

  const { error } = await supabase
    .from("tarefa_board_itens")
    .upsert(payload, { onConflict: "usuario_id,tarefa_id" });
  if (error) throw error;
}

export async function reorderTarefasLista(orderedTarefaIds: string[]): Promise<void> {
  const usuarioId = await requireUserId();
  const { data: current, error: curError } = await supabase
    .from("tarefa_board_itens")
    .select("tarefa_id, coluna_id, posicao_coluna")
    .eq("usuario_id", usuarioId)
    .in("tarefa_id", orderedTarefaIds);
  if (curError) throw curError;

  const meta = new Map(
    (current ?? []).map((r) => [
      r.tarefa_id,
      { coluna_id: r.coluna_id, posicao_coluna: r.posicao_coluna },
    ]),
  );

  const colunas = await ensureTarefaBoardColunas();
  const inbox = colunas.find((c) => c.is_inbox);
  if (!inbox) throw new Error("Coluna padrão não encontrada");

  const payload = orderedTarefaIds.map((tarefa_id, index) => {
    const prev = meta.get(tarefa_id);
    return {
      usuario_id: usuarioId,
      tarefa_id,
      coluna_id: prev?.coluna_id ?? inbox.id,
      posicao_coluna: prev?.posicao_coluna ?? index,
      posicao_lista: index,
    };
  });

  const { error } = await supabase
    .from("tarefa_board_itens")
    .upsert(payload, { onConflict: "usuario_id,tarefa_id" });
  if (error) throw error;
}
