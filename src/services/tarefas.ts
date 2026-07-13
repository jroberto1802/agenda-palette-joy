import { endOfDay, startOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  getCurrentActor,
  getTarefaStakeholderIds,
  notifyTarefaAtribuida,
  notifyTarefaComentario,
  notifyTarefaConcluida,
  notifyTarefaMencao,
  notifyTarefaMovida,
  notifyTarefaPrazo,
  notifyTarefaPrioridade,
  notifyTarefaResponsavel,
  notifyTarefaStatus,
  notifyTarefaSubtarefa,
  notifyTarefaSubtarefaConcluida,
  resolveDestinoLabel,
  resolveMentionIds,
} from "@/services/notificacao-events";
import {
  calcularProximaData,
  deveGerarProximaOcorrencia,
  parseRecorrencia,
  serializeRecorrencia,
} from "@/utils/recorrencia";
import type {
  DashboardKpis,
  Profile,
  SubtarefaFormData,
  SubtarefaWithRelations,
  TarefaComentario,
  TarefaDetail,
  TarefaFilters,
  TarefaFormData,
  TarefaLembreteOpcao,
  TarefaPrioridade,
  TarefaStatus,
  TarefaWithRelations,
} from "@/types";
import type { TablesUpdate } from "@/types/database";

const TAREFA_SELECT = `
  *,
  setor:setores(id, nome, cor),
  projeto:projetos(id, nome),
  criador:profiles!criado_por(id, nome_completo, avatar_url),
  responsavel:profiles!atribuido_a(id, nome_completo, avatar_url),
  responsaveis:tarefa_responsaveis(
    usuario_id,
    usuario:profiles!tarefa_responsaveis_usuario_id_fkey(id, nome_completo, avatar_url)
  ),
  observadores:tarefa_observadores(
    usuario_id,
    usuario:profiles!tarefa_observadores_usuario_id_fkey(id, nome_completo, avatar_url)
  )
`;

const TAREFA_SELECT_LITE = `
  *,
  setor:setores(id, nome, cor),
  projeto:projetos(id, nome),
  criador:profiles!criado_por(id, nome_completo, avatar_url),
  responsavel:profiles!atribuido_a(id, nome_completo, avatar_url),
  responsaveis:tarefa_responsaveis(
    usuario_id,
    usuario:profiles!tarefa_responsaveis_usuario_id_fkey(id, nome_completo, avatar_url)
  )
`;

const SUBTAREFA_SELECT = `
  id, tarefa_id, titulo, descricao, prioridade, data_prazo, concluida, created_at,
  criado_por, concluido_por, concluida_em,
  criador:profiles!criado_por(id, nome_completo, avatar_url),
  concluido_por_usuario:profiles!concluido_por(id, nome_completo, avatar_url),
  responsaveis:subtarefa_responsaveis(
    usuario_id,
    usuario:profiles!subtarefa_responsaveis_usuario_id_fkey(id, nome_completo, avatar_url)
  )
`;
function serializeLembretes(lembretes: TarefaLembreteOpcao[]): TarefaLembreteOpcao[] {
  return lembretes;
}

function normalizeAtribuidoIds(payload: TarefaFormData): string[] {
  const fromList = payload.atribuido_ids?.filter(Boolean) ?? [];
  if (fromList.length > 0) return [...new Set(fromList)];
  if (payload.atribuido_a) return [payload.atribuido_a];
  return [];
}

function primaryAtribuido(ids: string[]): string | null {
  return ids[0] ?? null;
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
  const setorId = isPrivileged
    ? payload.setor_id
    : (profile.setor_id ?? payload.setor_id ?? null);

  let visibilidade = payload.visibilidade;
  if (!isPrivileged && !setorId && visibilidade === "todos_setor") {
    visibilidade = "todos_empresa";
  }

  return {
    ...payload,
    setor_id: setorId,
    visibilidade,
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

async function syncResponsaveis(tarefaId: string, usuarioIds: string[]): Promise<void> {
  const unique = [...new Set(usuarioIds.filter(Boolean))];
  if (unique.length === 0) {
    throw new Error("Selecione ao menos um responsável.");
  }

  const { error: deleteError } = await supabase
    .from("tarefa_responsaveis")
    .delete()
    .eq("tarefa_id", tarefaId);

  if (deleteError) throw deleteError;

  const { error: insertError } = await supabase.from("tarefa_responsaveis").insert(
    unique.map((usuario_id) => ({
      tarefa_id: tarefaId,
      usuario_id,
    })),
  );

  if (insertError) throw insertError;
}

async function listResponsavelIds(tarefaId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("tarefa_responsaveis")
    .select("usuario_id")
    .eq("tarefa_id", tarefaId);

  if (error) throw error;
  return (data ?? []).map((row) => row.usuario_id);
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

  if (filters.projeto_id && filters.projeto_id !== "all") {
    query = query.eq("projeto_id", filters.projeto_id);
  }

  const atribuidoIds = [
    ...(filters.atribuido_ids ?? []),
    ...(filters.atribuido_a && filters.atribuido_a !== "all" ? [filters.atribuido_a] : []),
  ].filter(Boolean);

  if (atribuidoIds.length > 0) {
    const { data: links, error: linksError } = await supabase
      .from("tarefa_responsaveis")
      .select("tarefa_id")
      .in("usuario_id", atribuidoIds);

    if (linksError) throw linksError;

    const tarefaIds = [...new Set((links ?? []).map((row) => row.tarefa_id))];
    if (tarefaIds.length === 0) return [];
    query = query.in("id", tarefaIds);
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

  const responsavelIds =
    tarefa.responsaveis?.map((r) => r.usuario_id).filter(Boolean) ??
    (tarefa.atribuido_a ? [tarefa.atribuido_a] : []);

  const novaId = crypto.randomUUID();

  const { error } = await supabase.from("tarefas").insert({
    id: novaId,
    titulo: tarefa.titulo,
    descricao: tarefa.descricao,
    projeto_id: tarefa.projeto_id,
    setor_id: tarefa.setor_id,
    atribuido_a: primaryAtribuido(responsavelIds),
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

  if (responsavelIds.length > 0) {
    await syncResponsaveis(novaId, responsavelIds);
  }
}

export async function createTarefa(payload: TarefaFormData): Promise<TarefaWithRelations> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  const profile = await getCurrentProfile();
  const normalized = normalizeSetorForCreate(payload, profile);
  const atribuidoIds = normalizeAtribuidoIds(normalized);
  const tarefaId = crypto.randomUUID();

  if (atribuidoIds.length === 0) {
    throw new Error("Selecione ao menos um responsável.");
  }

  if (normalized.visibilidade === "todos_setor" && !normalized.setor_id) {
    throw new Error('Setor é obrigatório para visibilidade "Todos do setor".');
  }

  if (
    normalized.visibilidade === "pessoas_especificas" &&
    normalized.observador_ids.length === 0
  ) {
    throw new Error("Selecione ao menos uma pessoa para visibilidade específica.");
  }

  const { error } = await supabase
    .from("tarefas")
    .insert({
      id: tarefaId,
      titulo: normalized.titulo,
      descricao: normalized.descricao || null,
      projeto_id: normalized.projeto_id,
      setor_id: normalized.setor_id,
      atribuido_a: primaryAtribuido(atribuidoIds),
      prioridade: normalized.prioridade,
      status: normalized.status,
      data_inicio: normalized.data_inicio,
      data_vencimento: normalized.data_vencimento,
      tags: normalized.tags,
      recorrencia: serializeRecorrencia(normalized.recorrencia),
      visibilidade: normalized.visibilidade,
      lembretes: serializeLembretes(normalized.lembretes),
      criado_por: user.id,
    });

  if (error) throw error;

  await syncResponsaveis(tarefaId, atribuidoIds);

  if (normalized.visibilidade === "pessoas_especificas") {
    await syncObservadores(tarefaId, normalized.observador_ids);
  }

  if (normalized.subtarefas?.length) {
    for (const sub of normalized.subtarefas) {
      if (!sub.titulo.trim()) continue;
      await createSubtarefa({
        tarefaId,
        titulo: sub.titulo.trim(),
        descricao: sub.descricao ?? null,
        prioridade: sub.prioridade ?? null,
        data_prazo: sub.data_prazo ?? null,
        atribuido_ids: sub.atribuido_ids ?? [],
        silent: true,
      });
    }
  }

  const { data, error: fetchError } = await supabase
    .from("tarefas")
    .select(TAREFA_SELECT)
    .eq("id", tarefaId)
    .single();
  if (fetchError) {
    const { data: fallback, error: fallbackError } = await supabase
      .from("tarefas")
      .select(TAREFA_SELECT_LITE)
      .eq("id", tarefaId)
      .single();

    if (fallbackError) throw fetchError;
    const tarefa = {
      ...(fallback as TarefaWithRelations),
      observadores: [],
    };

    await notifyTarefaAtribuida({
      usuarioIds: atribuidoIds,
      tarefaId: tarefa.id,
      atorNome: (await getCurrentActor())?.nome ?? "Alguém",
    }).catch(() => undefined);

    return tarefa;
  }

  const tarefa = data as TarefaWithRelations;

  await notifyTarefaAtribuida({
    usuarioIds: atribuidoIds,
    tarefaId: tarefa.id,
    atorNome: (await getCurrentActor())?.nome ?? "Alguém",
  }).catch(() => undefined);

  return tarefa;
}

export async function updateTarefa(
  id: string,
  payload: TarefaFormData,
): Promise<TarefaWithRelations> {
  const atribuidoIds = normalizeAtribuidoIds(payload);
  if (atribuidoIds.length === 0) {
    throw new Error("Selecione ao menos um responsável.");
  }

  const { data: anterior } = await supabase
    .from("tarefas")
    .select(
      "atribuido_a, status, recorrencia, data_vencimento, titulo, descricao, setor_id, projeto_id, prioridade, tags, criado_por",
    )
    .eq("id", id)
    .single();

  const anterioresIds = await listResponsavelIds(id);

  const updateData: TablesUpdate<"tarefas"> = {
    titulo: payload.titulo,
    descricao: payload.descricao || null,
    projeto_id: payload.projeto_id,
    setor_id: payload.setor_id,
    atribuido_a: primaryAtribuido(atribuidoIds),
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

  await syncResponsaveis(id, atribuidoIds);

  if (payload.visibilidade === "pessoas_especificas") {
    await syncObservadores(id, payload.observador_ids);
  } else {
    await syncObservadores(id, []);
  }

  const novos = atribuidoIds.filter((uid) => !anterioresIds.includes(uid));
  const responsaveisMudaram =
    novos.length > 0 || anterioresIds.some((uid) => !atribuidoIds.includes(uid));
  const ator = await getCurrentActor();
  const atorNome = ator?.nome ?? "Alguém";
  const stakeholders = [
    ...new Set([...(anterior?.criado_por ? [anterior.criado_por] : []), ...atribuidoIds, ...anterioresIds]),
  ];

  if (novos.length > 0) {
    await notifyTarefaAtribuida({
      usuarioIds: novos,
      tarefaId: tarefa.id,
      atorNome,
    }).catch(() => undefined);
  }

  if (responsaveisMudaram) {
    await notifyTarefaResponsavel({
      usuarioIds: stakeholders.filter((uid) => !novos.includes(uid)),
      tarefaId: tarefa.id,
      titulo: tarefa.titulo,
      atorNome,
    }).catch(() => undefined);
  }

  if (payload.status !== anterior?.status) {
    if (payload.status === "concluida") {
      await notifyTarefaConcluida({
        usuarioIds: atribuidoIds,
        tarefaId: tarefa.id,
        atorNome,
      }).catch(() => undefined);
    } else {
      await notifyTarefaStatus({
        usuarioIds: stakeholders,
        tarefaId: tarefa.id,
        titulo: tarefa.titulo,
        status: payload.status,
        atorNome,
      }).catch(() => undefined);
    }
  }

  if (payload.prioridade !== anterior?.prioridade) {
    await notifyTarefaPrioridade({
      usuarioIds: stakeholders,
      tarefaId: tarefa.id,
      titulo: tarefa.titulo,
      prioridade: payload.prioridade,
      atorNome,
    }).catch(() => undefined);
  }

  if (payload.data_vencimento !== anterior?.data_vencimento) {
    await notifyTarefaPrazo({
      usuarioIds: stakeholders,
      tarefaId: tarefa.id,
      titulo: tarefa.titulo,
      atorNome,
    }).catch(() => undefined);
  }

  if (payload.setor_id !== anterior?.setor_id || payload.projeto_id !== anterior?.projeto_id) {
    const destino =
      (await resolveDestinoLabel({
        setorId: payload.setor_id,
        projetoId: payload.projeto_id,
      })) ?? "outro contexto";
    await notifyTarefaMovida({
      usuarioIds: stakeholders,
      tarefaId: tarefa.id,
      titulo: tarefa.titulo,
      destino,
      atorNome,
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
    .select("status, titulo, criado_por")
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

  const responsavelIds =
    tarefa.responsaveis?.map((r) => r.usuario_id) ??
    (tarefa.atribuido_a ? [tarefa.atribuido_a] : []);
  const stakeholders = [
    ...new Set([...(tarefa.criado_por ? [tarefa.criado_por] : []), ...responsavelIds]),
  ];
  const atorNome = (await getCurrentActor())?.nome ?? "Alguém";

  if (stakeholders.length > 0 && status !== anterior?.status) {
    if (status === "concluida") {
      await notifyTarefaConcluida({
        usuarioIds: responsavelIds,
        tarefaId: tarefa.id,
        atorNome,
      }).catch(() => undefined);
    } else {
      await notifyTarefaStatus({
        usuarioIds: stakeholders,
        tarefaId: tarefa.id,
        titulo: tarefa.titulo,
        status,
        atorNome,
      }).catch(() => undefined);
    }
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
      subtarefas(${SUBTAREFA_SELECT}),
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

async function syncSubtarefaResponsaveis(
  subtarefaId: string,
  usuarioIds: string[],
): Promise<void> {
  const unique = [...new Set(usuarioIds.filter(Boolean))];

  const { error: deleteError } = await supabase
    .from("subtarefa_responsaveis")
    .delete()
    .eq("subtarefa_id", subtarefaId);

  if (deleteError) throw deleteError;

  if (unique.length === 0) return;

  const { error: insertError } = await supabase.from("subtarefa_responsaveis").insert(
    unique.map((usuario_id) => ({
      subtarefa_id: subtarefaId,
      usuario_id,
    })),
  );

  if (insertError) throw insertError;
}

async function fetchSubtarefa(id: string): Promise<SubtarefaWithRelations> {
  const { data, error } = await supabase
    .from("subtarefas")
    .select(SUBTAREFA_SELECT)
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as unknown as SubtarefaWithRelations;
}

export type CreateSubtarefaParams = SubtarefaFormData & {
  tarefaId: string;
  silent?: boolean;
};

export async function createSubtarefa(
  params: CreateSubtarefaParams,
): Promise<SubtarefaWithRelations> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  const titulo = params.titulo.trim();
  if (!titulo) throw new Error("Título da subtarefa é obrigatório.");

  const { data, error } = await supabase
    .from("subtarefas")
    .insert({
      tarefa_id: params.tarefaId,
      titulo,
      descricao: params.descricao?.trim() || null,
      prioridade: params.prioridade ?? null,
      data_prazo: params.data_prazo ?? null,
      criado_por: user.id,
    })
    .select("id")
    .single();

  if (error) throw error;

  const atribuidoIds = params.atribuido_ids?.filter(Boolean) ?? [];
  if (atribuidoIds.length > 0) {
    await syncSubtarefaResponsaveis(data.id, atribuidoIds);
  }

  if (!params.silent) {
    const [{ data: tarefa }, ator] = await Promise.all([
      supabase.from("tarefas").select("titulo").eq("id", params.tarefaId).single(),
      getCurrentActor(),
    ]);
    const stakeholders = await getTarefaStakeholderIds(params.tarefaId);
    await notifyTarefaSubtarefa({
      usuarioIds: stakeholders,
      tarefaId: params.tarefaId,
      titulo: tarefa?.titulo ?? "tarefa",
      atorNome: ator?.nome ?? "Alguém",
    }).catch(() => undefined);
  }

  return fetchSubtarefa(data.id);
}

export type UpdateSubtarefaParams = {
  titulo?: string;
  descricao?: string | null;
  prioridade?: TarefaPrioridade | null;
  data_prazo?: string | null;
  atribuido_ids?: string[];
};

export async function updateSubtarefa(
  id: string,
  params: UpdateSubtarefaParams,
): Promise<SubtarefaWithRelations> {
  const patch: TablesUpdate<"subtarefas"> = {};
  if (params.titulo !== undefined) patch.titulo = params.titulo.trim();
  if (params.descricao !== undefined) patch.descricao = params.descricao?.trim() || null;
  if (params.prioridade !== undefined) patch.prioridade = params.prioridade;
  if (params.data_prazo !== undefined) patch.data_prazo = params.data_prazo;

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from("subtarefas").update(patch).eq("id", id);
    if (error) throw error;
  }

  if (params.atribuido_ids !== undefined) {
    await syncSubtarefaResponsaveis(id, params.atribuido_ids);
  }

  return fetchSubtarefa(id);
}

export async function toggleSubtarefa(
  id: string,
  concluida: boolean,
): Promise<SubtarefaWithRelations> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  const { data: atual } = await supabase
    .from("subtarefas")
    .select("id, tarefa_id, concluida")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("subtarefas")
    .update({
      concluida,
      concluido_por: concluida ? user.id : null,
      concluida_em: concluida ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (error) throw error;

  if (concluida && !atual?.concluida && atual?.tarefa_id) {
    const [{ data: tarefa }, ator, stakeholders] = await Promise.all([
      supabase.from("tarefas").select("titulo").eq("id", atual.tarefa_id).single(),
      getCurrentActor(),
      getTarefaStakeholderIds(atual.tarefa_id),
    ]);
    await notifyTarefaSubtarefaConcluida({
      usuarioIds: stakeholders,
      tarefaId: atual.tarefa_id,
      titulo: tarefa?.titulo ?? "tarefa",
      atorNome: ator?.nome ?? "Alguém",
    }).catch(() => undefined);
  }

  return fetchSubtarefa(id);
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

  const [{ data: tarefa }, ator, mentionedIds] = await Promise.all([
    supabase.from("tarefas").select("criado_por, titulo").eq("id", tarefaId).single(),
    getCurrentActor(),
    resolveMentionIds(conteudo),
  ]);

  const responsavelIds = await listResponsavelIds(tarefaId);
  const stakeholders = [...new Set([tarefa?.criado_por, ...responsavelIds])].filter(
    (id): id is string => !!id && id !== user.id,
  );
  const mencoes = mentionedIds.filter((id) => id !== user.id);
  const comentarioOnly = stakeholders.filter((id) => !mencoes.includes(id));
  const atorNome = ator?.nome ?? "Alguém";
  const titulo = tarefa?.titulo ?? "tarefa";

  if (comentarioOnly.length > 0) {
    await notifyTarefaComentario({
      usuarioIds: comentarioOnly,
      tarefaId,
      titulo,
      comentarioId: comentario.id,
      atorNome,
    }).catch(() => undefined);
  }

  if (mencoes.length > 0) {
    await notifyTarefaMencao({
      usuarioIds: mencoes,
      tarefaId,
      comentarioId: comentario.id,
      atorNome,
    }).catch(() => undefined);
  }

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
