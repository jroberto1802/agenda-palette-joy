import { endOfDay, startOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { notifyUser, notifyUsers } from "@/services/notificacoes";
import {
  calcularProximaData,
  deveGerarProximaOcorrencia,
  parseRecorrencia,
  serializeRecorrencia,
} from "@/utils/recorrencia";
import type {
  DashboardKpis,
  Profile,
  Subtarefa,
  TarefaComentario,
  TarefaDetail,
  TarefaFilters,
  TarefaFormData,
  TarefaLembreteOpcao,
  TarefaStatus,
  TarefaWithRelations,
} from "@/types";
import type { TablesUpdate } from "@/types/database";

const TAREFA_SELECT = `
  *,
  setor:setores(id, nome, cor),
  criador:profiles!criado_por(id, nome_completo, avatar_url),
  responsavel:profiles!atribuido_a(id, nome_completo, avatar_url),
  observadores:tarefa_observadores(
    usuario_id,
    usuario:profiles!tarefa_observadores_usuario_id_fkey(id, nome_completo, avatar_url)
  )
`;

function serializeLembretes(lembretes: TarefaLembreteOpcao[]): TarefaLembreteOpcao[] {
  return lembretes;
}

async function getCurrentProfile(): Promise<Profile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return data;
}

function normalizeSetorForCreate(payload: TarefaFormData, profile: Profile | null): TarefaFormData {
  if (!profile) return payload;

  const isPrivileged = profile.papel === "admin" || profile.papel === "gerente";
  if (isPrivileged) return payload;

  return {
    ...payload,
    setor_id: profile.setor_id ?? payload.setor_id ?? null,
  };
}

async function syncObservadores(tarefaId: string, usuarioIds: string[]): Promise<void> {
  const { error: deleteError } = await supabase
    .from("tarefa_observadores")
    .delete()
    .eq("tarefa_id", tarefaId);

  if (deleteError) throw deleteError;

  if (usuarioIds.length === 0) return;

  const { error: insertError } = await supabase.from("tarefa_observadores").insert(
    usuarioIds.map((usuario_id) => ({
      tarefa_id: tarefaId,
      usuario_id,
    })),
  );

  if (insertError) throw insertError;
}

export async function listTarefas(filters: TarefaFilters = {}): Promise<TarefaWithRelations[]> {
  let query = supabase
    .from("tarefas")
    .select(TAREFA_SELECT)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.prioridade && filters.prioridade !== "all") {
    query = query.eq("prioridade", filters.prioridade);
  }

  if (filters.setor_id && filters.setor_id !== "all") {
    query = query.eq("setor_id", filters.setor_id);
  }

  if (filters.atribuido_a && filters.atribuido_a !== "all") {
    query = query.eq("atribuido_a", filters.atribuido_a);
  }

  if (filters.search?.trim()) {
    const term = filters.search.trim();
    query = query.or(`titulo.ilike.%${term}%,descricao.ilike.%${term}%`);
  }

  if (filters.tag?.trim()) {
    query = query.contains("tags", [filters.tag.trim()]);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as TarefaWithRelations[];
}

export async function getTarefa(id: string): Promise<TarefaWithRelations> {
  const { data, error } = await supabase
    .from("tarefas")
    .select(TAREFA_SELECT)
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error) throw error;
  return data as TarefaWithRelations;
}

export async function listRecentTarefas(limit = 5): Promise<TarefaWithRelations[]> {
  const { data, error } = await supabase
    .from("tarefas")
    .select(TAREFA_SELECT)
    .is("deleted_at", null)
    .neq("status", "concluida")
    .order("data_vencimento", { ascending: true, nullsFirst: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as TarefaWithRelations[];
}

export async function listTarefasCalendario(
  inicio: string,
  fim: string,
): Promise<TarefaWithRelations[]> {
  const { data, error } = await supabase
    .from("tarefas")
    .select(TAREFA_SELECT)
    .is("deleted_at", null)
    .not("data_vencimento", "is", null)
    .gte("data_vencimento", inicio)
    .lte("data_vencimento", fim)
    .order("data_vencimento", { ascending: true });

  if (error) throw error;
  return (data ?? []) as TarefaWithRelations[];
}

async function spawnProximaOcorrencia(tarefa: TarefaWithRelations): Promise<void> {
  const config = parseRecorrencia(tarefa.recorrencia);
  if (!config) return;

  const proxima = calcularProximaData(tarefa.data_vencimento, config);
  if (!proxima || !deveGerarProximaOcorrencia(config, proxima)) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.from("tarefas").insert({
    titulo: tarefa.titulo,
    descricao: tarefa.descricao,
    setor_id: tarefa.setor_id,
    atribuido_a: tarefa.atribuido_a,
    prioridade: tarefa.prioridade,
    status: "a_fazer",
    data_inicio: tarefa.data_inicio,
    data_vencimento: proxima.toISOString(),
    tags: tarefa.tags,
    recorrencia: serializeRecorrencia(config),
    visibilidade: tarefa.visibilidade,
    lembretes: tarefa.lembretes,
    criado_por: user.id,
  });

  if (error) throw error;
}

export async function createTarefa(payload: TarefaFormData): Promise<TarefaWithRelations> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  const profile = await getCurrentProfile();
  const normalized = normalizeSetorForCreate(payload, profile);

  if (normalized.visibilidade === "todos_setor" && !normalized.setor_id) {
    throw new Error('Setor é obrigatório para visibilidade "Todos do setor".');
  }

  if (
    normalized.visibilidade === "pessoas_especificas" &&
    normalized.observador_ids.length === 0
  ) {
    throw new Error("Selecione ao menos uma pessoa para visibilidade específica.");
  }

  const { data, error } = await supabase
    .from("tarefas")
    .insert({
      titulo: normalized.titulo,
      descricao: normalized.descricao || null,
      setor_id: normalized.setor_id,
      atribuido_a: normalized.atribuido_a,
      prioridade: normalized.prioridade,
      status: normalized.status,
      data_inicio: normalized.data_inicio,
      data_vencimento: normalized.data_vencimento,
      tags: normalized.tags,
      recorrencia: serializeRecorrencia(normalized.recorrencia),
      visibilidade: normalized.visibilidade,
      lembretes: serializeLembretes(normalized.lembretes),
      criado_por: user.id,
    })
    .select(TAREFA_SELECT)
    .single();

  if (error) throw error;
  const tarefa = data as TarefaWithRelations;

  if (normalized.visibilidade === "pessoas_especificas") {
    await syncObservadores(tarefa.id, normalized.observador_ids);
  }

  if (tarefa.atribuido_a) {
    await notifyUser({
      usuario_id: tarefa.atribuido_a,
      tipo: "tarefa_atribuida",
      referencia_tipo: "tarefa",
      referencia_id: tarefa.id,
    }).catch(() => undefined);
  }

  return tarefa;
}

export async function updateTarefa(
  id: string,
  payload: TarefaFormData,
): Promise<TarefaWithRelations> {
  const { data: anterior } = await supabase
    .from("tarefas")
    .select("atribuido_a, status, recorrencia, data_vencimento, titulo, descricao, setor_id, prioridade, tags")
    .eq("id", id)
    .single();

  const updateData: TablesUpdate<"tarefas"> = {
    titulo: payload.titulo,
    descricao: payload.descricao || null,
    setor_id: payload.setor_id,
    atribuido_a: payload.atribuido_a,
    prioridade: payload.prioridade,
    status: payload.status,
    data_inicio: payload.data_inicio,
    data_vencimento: payload.data_vencimento,
    tags: payload.tags,
    recorrencia: serializeRecorrencia(payload.recorrencia),
    visibilidade: payload.visibilidade,
    lembretes: serializeLembretes(payload.lembretes),
  };

  if (payload.status === "concluida") {
    updateData.data_conclusao = new Date().toISOString();
  } else {
    updateData.data_conclusao = null;
  }

  const { data, error } = await supabase
    .from("tarefas")
    .update(updateData)
    .eq("id", id)
    .select(TAREFA_SELECT)
    .single();

  if (error) throw error;
  const tarefa = data as TarefaWithRelations;

  if (payload.visibilidade === "pessoas_especificas") {
    await syncObservadores(id, payload.observador_ids);
  } else {
    await syncObservadores(id, []);
  }

  if (
    payload.atribuido_a &&
    payload.atribuido_a !== anterior?.atribuido_a
  ) {
    await notifyUser({
      usuario_id: payload.atribuido_a,
      tipo: "tarefa_atribuida",
      referencia_tipo: "tarefa",
      referencia_id: tarefa.id,
    }).catch(() => undefined);
  }

  if (payload.status !== anterior?.status && tarefa.atribuido_a) {
    await notifyUser({
      usuario_id: tarefa.atribuido_a,
      tipo: "tarefa_status",
      referencia_tipo: "tarefa",
      referencia_id: tarefa.id,
    }).catch(() => undefined);
  }

  if (payload.status === "concluida" && anterior?.status !== "concluida") {
    await spawnProximaOcorrencia(tarefa).catch(() => undefined);
  }

  return tarefa;
}

export async function updateTarefaStatus(
  id: string,
  status: TarefaStatus,
): Promise<TarefaWithRelations> {
  const { data: anterior } = await supabase
    .from("tarefas")
    .select("status")
    .eq("id", id)
    .single();

  const updateData: TablesUpdate<"tarefas"> = { status };

  if (status === "concluida") {
    updateData.data_conclusao = new Date().toISOString();
  } else {
    updateData.data_conclusao = null;
  }

  const { data, error } = await supabase
    .from("tarefas")
    .update(updateData)
    .eq("id", id)
    .select(TAREFA_SELECT)
    .single();

  if (error) throw error;
  const tarefa = data as TarefaWithRelations;

  if (tarefa.atribuido_a) {
    await notifyUser({
      usuario_id: tarefa.atribuido_a,
      tipo: "tarefa_status",
      referencia_tipo: "tarefa",
      referencia_id: tarefa.id,
    }).catch(() => undefined);
  }

  if (status === "concluida" && anterior?.status !== "concluida") {
    await spawnProximaOcorrencia(tarefa).catch(() => undefined);
  }

  return tarefa;
}

export async function softDeleteTarefa(id: string): Promise<void> {
  const { error } = await supabase
    .from("tarefas")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

const COMENTARIO_SELECT = `
  *,
  usuario:profiles!usuario_id(id, nome_completo, avatar_url)
`;

export async function getTarefaDetail(id: string): Promise<TarefaDetail> {
  const { data, error } = await supabase
    .from("tarefas")
    .select(
      `${TAREFA_SELECT},
      subtarefas(id, tarefa_id, titulo, concluida, created_at),
      comentarios:tarefa_comentarios(${COMENTARIO_SELECT}),
      anexos:tarefa_anexos(id, tarefa_id, storage_path, nome, tipo, tamanho, created_at)`,
    )
    .eq("id", id)
    .is("deleted_at", null)
    .order("created_at", { referencedTable: "subtarefas", ascending: true })
    .order("created_at", { referencedTable: "tarefa_comentarios", ascending: true })
    .single();

  if (error) throw error;
  return data as unknown as TarefaDetail;
}

export async function createSubtarefa(tarefaId: string, titulo: string): Promise<Subtarefa> {
  const { data, error } = await supabase
    .from("subtarefas")
    .insert({ tarefa_id: tarefaId, titulo })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function toggleSubtarefa(id: string, concluida: boolean): Promise<Subtarefa> {
  const { data, error } = await supabase
    .from("subtarefas")
    .update({ concluida })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteSubtarefa(id: string): Promise<void> {
  const { error } = await supabase.from("subtarefas").delete().eq("id", id);
  if (error) throw error;
}

export async function createTarefaComentario(
  tarefaId: string,
  conteudo: string,
): Promise<TarefaComentario> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  const { data, error } = await supabase
    .from("tarefa_comentarios")
    .insert({ tarefa_id: tarefaId, usuario_id: user.id, conteudo })
    .select(COMENTARIO_SELECT)
    .single();

  if (error) throw error;
  const comentario = data as TarefaComentario;

  const { data: tarefa } = await supabase
    .from("tarefas")
    .select("criado_por, atribuido_a")
    .eq("id", tarefaId)
    .single();

  const destinatarios = [tarefa?.criado_por, tarefa?.atribuido_a].filter(
    (id): id is string => !!id && id !== user.id,
  );

  await notifyUsers(destinatarios, {
    tipo: "tarefa_comentario",
    referencia_tipo: "tarefa",
    referencia_id: tarefaId,
  });

  return comentario;
}

export async function deleteTarefaComentario(id: string): Promise<void> {
  const { error } = await supabase.from("tarefa_comentarios").delete().eq("id", id);
  if (error) throw error;
}

export async function getDashboardKpis(): Promise<DashboardKpis> {
  const hojeInicio = startOfDay(new Date()).toISOString();
  const hojeFim = endOfDay(new Date()).toISOString();

  const [tarefasRes, setoresRes, pessoasRes] = await Promise.all([
    supabase
      .from("tarefas")
      .select("status, data_vencimento")
      .is("deleted_at", null),
    supabase.from("setores").select("id", { count: "exact", head: true }),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("ativo", true),
  ]);

  if (tarefasRes.error) throw tarefasRes.error;
  if (setoresRes.error) throw setoresRes.error;
  if (pessoasRes.error) throw pessoasRes.error;

  const tarefas = tarefasRes.data ?? [];

  return {
    totalTarefas: tarefas.length,
    tarefasAFazer: tarefas.filter((t) => t.status === "a_fazer").length,
    tarefasEmAndamento: tarefas.filter((t) => t.status === "em_andamento").length,
    tarefasConcluidas: tarefas.filter((t) => t.status === "concluida").length,
    tarefasBloqueadas: tarefas.filter((t) => t.status === "bloqueada").length,
    tarefasVencendoHoje: tarefas.filter(
      (t) =>
        t.data_vencimento &&
        t.data_vencimento >= hojeInicio &&
        t.data_vencimento <= hojeFim &&
        t.status !== "concluida",
    ).length,
    totalSetores: setoresRes.count ?? 0,
    totalPessoas: pessoasRes.count ?? 0,
  };
}
