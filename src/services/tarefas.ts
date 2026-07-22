import { endOfDay, startOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { buscarSubtarefaIds, buscarTarefaIds } from "@/services/busca";
import {
  getCurrentActor,
  getSubtarefaStakeholderIds,
  getTarefaStakeholderIds,
  listSubtarefaMencionaveis,
  listTarefaMencionaveis,
  notifySubtarefaMencao,
  notifySubtarefaPrazo,
  notifyTarefaComentario,
  notifyTarefaConcluida,
  notifyTarefaMencao,
  notifyTarefaPrazo,
  notifyTarefaResposta,
  notifyTarefaSubtarefaConcluida,
  notifyTarefaVisualizador,
  resolveMentionIds,
  resolveTarefaVisualizadorIds,
} from "@/services/notificacao-events";
import { notifyUsers } from "@/services/notificacoes";
import { localDateRangeToIsoBounds, startOfTodayLocal, toLocalDateKey } from "@/utils/agenda-datas";
import { sortSubtarefasList } from "@/utils/tarefas";
import { serializeRecorrencia, isSerieModelo, isSerieOcorrencia } from "@/utils/recorrencia";
import { atualizarProximaDataModelo, materializarOcorrenciasDevidas } from "@/services/tarefa-recorrencia";
import type {
  DashboardKpis,
  Profile,
  SubtarefaAgendaFilters,
  SubtarefaAgendaItem,
  SubtarefaComentario,
  SubtarefaDetail,
  SubtarefaFormData,
  SubtarefaWithAuthors,
  TarefaComentario,
  TarefaDetail,
  TarefaFilters,
  TarefaFormData,
  TarefaLembreteOpcao,
  TarefaWithRelations,
} from "@/types";
import type { Json, TablesUpdate } from "@/types/database";

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

async function listObservadorIds(tarefaId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("tarefa_observadores")
    .select("usuario_id")
    .eq("tarefa_id", tarefaId);

  if (error) throw error;
  return (data ?? []).map((row) => row.usuario_id);
}

/** Notifica quem passou a ter acesso de visualização (exclui responsáveis, criador e o ator). */
async function notifyNovosVisualizadores(params: {
  tarefaId: string;
  titulo: string;
  novosVisualizadorIds: string[];
  responsavelIds: string[];
  criadoPor?: string | null;
}) {
  if (params.novosVisualizadorIds.length === 0) return;

  const ator = await getCurrentActor();
  const excluidos = new Set(
    [...params.responsavelIds, params.criadoPor, ator?.id].filter(
      (id): id is string => !!id,
    ),
  );
  const alvos = params.novosVisualizadorIds.filter((id) => !excluidos.has(id));
  if (alvos.length === 0) return;

  await notifyTarefaVisualizador({
    usuarioIds: alvos,
    tarefaId: params.tarefaId,
    titulo: params.titulo,
    atorNome: ator?.nome ?? "Alguém",
  }).catch(() => undefined);
}

export async function listTarefas(filters: TarefaFilters = {}): Promise<TarefaWithRelations[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase.from("tarefas").select(TAREFA_SELECT).is("deleted_at", null);

  if (filters.somente_finalizadas) {
    query = query.eq("concluida", true);
    query = query.order("data_conclusao", { ascending: false, nullsFirst: false });
  } else {
    if (filters.excluir_finalizadas) {
      query = query.eq("concluida", false);
    }
    query = query.order("created_at", { ascending: false });
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

  /** Interseção de IDs (busca local + responsáveis) — evita dois `.in("id")` conflitantes. */
  let allowedIds: string[] | null = null;

  const searchTerm = filters.search?.trim() ?? "";
  if (searchTerm.length >= 2) {
    const searchIds = await buscarTarefaIds(searchTerm);
    if (searchIds.length === 0) return [];
    allowedIds = searchIds;
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

    if (allowedIds) {
      const atribuidoSet = new Set(tarefaIds);
      allowedIds = allowedIds.filter((id) => atribuidoSet.has(id));
      if (allowedIds.length === 0) return [];
    } else {
      allowedIds = tarefaIds;
    }
  }

  let excludeIds = new Set<string>();
  if (filters.somente_visualizando) {
    if (!user) return [];
    query = query
      .neq("criado_por", user.id)
      .neq("visibilidade", "somente_para_mim");

    const { data: myLinks, error: myLinksError } = await supabase
      .from("tarefa_responsaveis")
      .select("tarefa_id")
      .eq("usuario_id", user.id);
    if (myLinksError) throw myLinksError;
    excludeIds = new Set((myLinks ?? []).map((row) => row.tarefa_id));

    if (allowedIds) {
      allowedIds = allowedIds.filter((id) => !excludeIds.has(id));
      if (allowedIds.length === 0) return [];
    }
  }

  if (allowedIds) {
    query = query.in("id", allowedIds);
  }

  if (filters.tag?.trim()) {
    query = query.contains("tags", [filters.tag.trim()]);
  }

  if (filters.periodo_inicio?.trim()) {
    query = query.gte("data_conclusao", `${filters.periodo_inicio.trim()}T00:00:00.000Z`);
  }

  if (filters.periodo_fim?.trim()) {
    query = query.lte("data_conclusao", `${filters.periodo_fim.trim()}T23:59:59.999Z`);
  }

  if (filters.somente_atrasadas) {
    query = query
      .not("data_inicio", "is", null)
      .lt("data_inicio", startOfTodayLocal().toISOString());
  } else {
    const dataInicioDe = filters.data_inicio_de?.trim();
    const dataInicioAte = filters.data_inicio_ate?.trim();
    if (dataInicioDe || dataInicioAte) {
      query = query.not("data_inicio", "is", null);
      const de = dataInicioDe || dataInicioAte!;
      const ate = dataInicioAte || dataInicioDe!;
      const { startIso, endIso } = localDateRangeToIsoBounds(de, ate);
      query = query.gte("data_inicio", startIso).lte("data_inicio", endIso);
    }
  }

  const { data, error } = await query;
  if (error) throw error;

  let rows = (data ?? []) as TarefaWithRelations[];

  if (filters.somente_visualizando && user) {
    rows = rows.filter((tarefa) => {
      if (excludeIds.has(tarefa.id)) return false;
      if (tarefa.criado_por === user.id) return false;
      if (tarefa.atribuido_a === user.id) return false;
      if (tarefa.responsaveis?.some((r) => r.usuario_id === user.id)) return false;
      if (tarefa.visibilidade === "somente_para_mim") return false;
      return true;
    });
  }

  return rows;
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
    .eq("concluida", false)
    .order("data_inicio", { ascending: true, nullsFirst: false })
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
    .eq("concluida", false)
    .not("data_inicio", "is", null)
    .gte("data_inicio", inicio)
    .lte("data_inicio", fim)
    .order("data_inicio", { ascending: true });

  if (error) throw error;
  return (data ?? []) as TarefaWithRelations[];
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

  if (normalized.visibilidade === "todos_projeto" && !normalized.projeto_id) {
    throw new Error('Projeto é obrigatório para visibilidade "Todos do projeto".');
  }

  if (
    normalized.visibilidade === "pessoas_especificas" &&
    normalized.observador_ids.length === 0
  ) {
    throw new Error("Selecione ao menos uma pessoa para visibilidade específica.");
  }

  const recorrencia = serializeRecorrencia(normalized.recorrencia);
  const ancoraKey = normalized.data_inicio
    ? toLocalDateKey(normalized.data_inicio)
    : null;
  const recorrenciaComAncora =
    recorrencia && ancoraKey
      ? { ...recorrencia, data_ancora: recorrencia.data_ancora ?? ancoraKey }
      : recorrencia;

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
      data_inicio: normalized.data_inicio,
      tags: normalized.tags,
      recorrencia: recorrenciaComAncora,
      serie_raiz_id: recorrenciaComAncora ? tarefaId : null,
      visibilidade: normalized.visibilidade,
      lembretes: serializeLembretes(normalized.lembretes),
      criado_por: user.id,
    });

  if (error) throw error;

  await syncResponsaveis(tarefaId, atribuidoIds);

  if (normalized.visibilidade === "pessoas_especificas") {
    await syncObservadores(tarefaId, normalized.observador_ids);
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

    await notifyUsers(atribuidoIds, {
      tipo: "tarefa_atribuida",
      referencia_tipo: "tarefa",
      referencia_id: tarefa.id,
    }).catch(() => undefined);

    const visualizadores = await resolveTarefaVisualizadorIds({
      visibilidade: normalized.visibilidade,
      setorId: normalized.setor_id,
      projetoId: normalized.projeto_id,
      observadorIds: normalized.observador_ids,
    });
    await notifyNovosVisualizadores({
      tarefaId: tarefa.id,
      titulo: tarefa.titulo,
      novosVisualizadorIds: visualizadores,
      responsavelIds: atribuidoIds,
      criadoPor: user.id,
    });

    if (recorrenciaComAncora) {
      await materializarOcorrenciasDevidas().catch(() => undefined);
      await atualizarProximaDataModelo(tarefaId).catch(() => undefined);
    }

    return tarefa;
  }

  const tarefa = data as TarefaWithRelations;

  await notifyUsers(atribuidoIds, {
    tipo: "tarefa_atribuida",
    referencia_tipo: "tarefa",
    referencia_id: tarefa.id,
  }).catch(() => undefined);

  const visualizadores = await resolveTarefaVisualizadorIds({
    visibilidade: normalized.visibilidade,
    setorId: normalized.setor_id,
    projetoId: normalized.projeto_id,
    observadorIds: normalized.observador_ids,
  });
  await notifyNovosVisualizadores({
    tarefaId: tarefa.id,
    titulo: tarefa.titulo,
    novosVisualizadorIds: visualizadores,
    responsavelIds: atribuidoIds,
    criadoPor: user.id,
  });

  // Modelo permanente: materializa ocorrências devidas e atualiza próxima prevista
  if (recorrenciaComAncora) {
    await materializarOcorrenciasDevidas().catch(() => undefined);
    await atualizarProximaDataModelo(tarefaId).catch(() => undefined);
    const { data: refreshed } = await supabase
      .from("tarefas")
      .select(TAREFA_SELECT)
      .eq("id", tarefaId)
      .single();
    if (refreshed) return refreshed as TarefaWithRelations;
  }

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

  if (payload.visibilidade === "todos_setor" && !payload.setor_id) {
    throw new Error('Setor é obrigatório para visibilidade "Todos do setor".');
  }

  if (payload.visibilidade === "todos_projeto" && !payload.projeto_id) {
    throw new Error('Projeto é obrigatório para visibilidade "Todos do projeto".');
  }

  if (payload.visibilidade === "pessoas_especificas" && payload.observador_ids.length === 0) {
    throw new Error("Selecione ao menos uma pessoa para visibilidade específica.");
  }

  const anterioresIds = await listResponsavelIds(id);
  const [{ data: anteriorMeta }, anterioresObservadores] = await Promise.all([
    supabase
      .from("tarefas")
      .select("data_inicio, visibilidade, setor_id, projeto_id, titulo, criado_por")
      .eq("id", id)
      .single(),
    listObservadorIds(id),
  ]);

  const anterioresVisualizadores = await resolveTarefaVisualizadorIds({
    visibilidade: (anteriorMeta?.visibilidade ?? "somente_para_mim") as TarefaFormData["visibilidade"],
    setorId: anteriorMeta?.setor_id,
    projetoId: anteriorMeta?.projeto_id,
    observadorIds: anterioresObservadores,
  });

  const recorrenciaSerialized = serializeRecorrencia(payload.recorrencia);
  const ancoraUpdate =
    payload.data_inicio != null ? toLocalDateKey(payload.data_inicio) : null;
  const recorrenciaUpdate =
    recorrenciaSerialized && ancoraUpdate
      ? {
          ...recorrenciaSerialized,
          data_ancora: recorrenciaSerialized.data_ancora ?? ancoraUpdate,
        }
      : recorrenciaSerialized;

  const updateData: TablesUpdate<"tarefas"> = {
    titulo: payload.titulo,
    descricao: payload.descricao || null,
    projeto_id: payload.projeto_id,
    setor_id: payload.setor_id,
    atribuido_a: primaryAtribuido(atribuidoIds),
    prioridade: payload.prioridade,
    data_inicio: payload.data_inicio,
    tags: payload.tags,
    recorrencia: recorrenciaUpdate,
    visibilidade: payload.visibilidade,
    lembretes: serializeLembretes(payload.lembretes),
  };

  // Se o formulário define recorrência nesta tarefa e ela ainda não é série, torna-a modelo
  let promoveuModelo = false;
  if (recorrenciaUpdate) {
    const { data: meta } = await supabase
      .from("tarefas")
      .select("serie_raiz_id")
      .eq("id", id)
      .single();
    if (!meta?.serie_raiz_id) {
      updateData.serie_raiz_id = id;
      promoveuModelo = true;
    }
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
  if (novos.length > 0) {
    await notifyUsers(novos, {
      tipo: "tarefa_atribuida",
      referencia_tipo: "tarefa",
      referencia_id: tarefa.id,
    }).catch(() => undefined);
  }

  const novosVisualizadores = (
    await resolveTarefaVisualizadorIds({
      visibilidade: payload.visibilidade,
      setorId: payload.setor_id,
      projetoId: payload.projeto_id,
      observadorIds: payload.observador_ids,
    })
  ).filter((uid) => !anterioresVisualizadores.includes(uid));

  await notifyNovosVisualizadores({
    tarefaId: tarefa.id,
    titulo: tarefa.titulo,
    novosVisualizadorIds: novosVisualizadores,
    responsavelIds: atribuidoIds,
    criadoPor: anteriorMeta?.criado_por ?? tarefa.criado_por,
  });

  if (toLocalDateKey(anteriorMeta?.data_inicio) !== toLocalDateKey(payload.data_inicio)) {
    const ator = await getCurrentActor();
    const stakeholders = await getTarefaStakeholderIds(id);
    const alvos = stakeholders.filter((uid) => uid !== ator?.id);
    if (alvos.length > 0) {
      await notifyTarefaPrazo({
        usuarioIds: alvos,
        tarefaId: id,
        titulo: tarefa.titulo,
        atorNome: ator?.nome ?? "Alguém",
        dataInicio: payload.data_inicio,
      }).catch(() => undefined);
    }
  }

  if (promoveuModelo || (isSerieModelo(tarefa) && recorrenciaUpdate)) {
    await materializarOcorrenciasDevidas().catch(() => undefined);
    await atualizarProximaDataModelo(id).catch(() => undefined);
    const { data: refreshed } = await supabase
      .from("tarefas")
      .select(TAREFA_SELECT)
      .eq("id", id)
      .single();
    if (refreshed) return refreshed as TarefaWithRelations;
  }

  return tarefa;
}

/** Altera apenas a Data da tarefa e notifica os demais responsáveis/stakeholders. */
export async function updateTarefaDataInicio(
  id: string,
  dataInicio: string | null,
): Promise<TarefaWithRelations> {
  const { data: anterior, error: anteriorError } = await supabase
    .from("tarefas")
    .select("data_inicio")
    .eq("id", id)
    .single();
  if (anteriorError) throw anteriorError;

  const { data, error } = await supabase
    .from("tarefas")
    .update({ data_inicio: dataInicio })
    .eq("id", id)
    .select(TAREFA_SELECT)
    .single();

  if (error) throw error;
  const tarefa = data as TarefaWithRelations;

  if (toLocalDateKey(anterior?.data_inicio) !== toLocalDateKey(dataInicio)) {
    const ator = await getCurrentActor();
    const stakeholders = await getTarefaStakeholderIds(id);
    const alvos = stakeholders.filter((uid) => uid !== ator?.id);
    if (alvos.length > 0) {
      await notifyTarefaPrazo({
        usuarioIds: alvos,
        tarefaId: id,
        titulo: tarefa.titulo,
        atorNome: ator?.nome ?? "Alguém",
        dataInicio,
      }).catch(() => undefined);
    }
  }

  return tarefa;
}

/**
 * Alterna o estado Aberta/Concluída da tarefa.
 * Se houver subtarefas abertas, o banco bloqueia a conclusão (trigger) e
 * o erro deve ser tratado pela camada de chamada (ver `getSupabaseErrorMessage`).
 */
export async function updateTarefaConclusao(
  id: string,
  concluida: boolean,
): Promise<TarefaWithRelations> {
  const { data: anterior } = await supabase
    .from("tarefas")
    .select("id, concluida, serie_raiz_id")
    .eq("id", id)
    .single();

  // Modelo da série é permanente: nunca conclui / não vai para Finalizados
  if (anterior && isSerieModelo(anterior) && concluida) {
    throw new Error(
      "O Modelo da Série não pode ser concluído. Conclua apenas as ocorrências individuais.",
    );
  }

  const updateData: TablesUpdate<"tarefas"> = {
    concluida,
    data_conclusao: concluida ? new Date().toISOString() : null,
  };

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

  if (concluida && !anterior?.concluida) {
    const ator = await getCurrentActor();
    const alvos = responsavelIds.filter((uid) => uid !== ator?.id);
    if (alvos.length > 0) {
      await notifyTarefaConcluida({
        usuarioIds: alvos,
        tarefaId: tarefa.id,
        atorNome: ator?.nome ?? "Alguém",
      }).catch(() => undefined);
    }
  }

  // Após concluir ocorrência, atualiza próxima prevista no modelo
  if (concluida && isSerieOcorrencia(tarefa) && tarefa.serie_raiz_id) {
    await atualizarProximaDataModelo(tarefa.serie_raiz_id).catch(() => undefined);
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
  usuario:profiles!usuario_id(id, nome_completo, avatar_url, papel),
  editor:profiles!editado_por(id, nome_completo, avatar_url)
`;

export async function getTarefaDetail(id: string): Promise<TarefaDetail> {
  const { data, error } = await supabase
    .from("tarefas")
    .select(
      `${TAREFA_SELECT},
      subtarefas(
        id, tarefa_id, titulo, concluida, posicao, created_at, criado_por, concluido_por,
        data_inicio, descricao, prioridade, lembretes,
        recorrencia, projeto_id, setor_id, visibilidade, updated_at,
        criador:profiles!subtarefas_criado_por_fkey(id, nome_completo, avatar_url),
        concluido_por_usuario:profiles!subtarefas_concluido_por_fkey(id, nome_completo, avatar_url),
        responsaveis:subtarefa_responsaveis(
          usuario_id,
          usuario:profiles!subtarefa_responsaveis_usuario_id_fkey(id, nome_completo, avatar_url)
        ),
        observadores:subtarefa_observadores(
          usuario_id,
          usuario:profiles!subtarefa_observadores_usuario_id_fkey(id, nome_completo, avatar_url)
        )
      ),
      comentarios:tarefa_comentarios(${COMENTARIO_SELECT}),
      anexos:tarefa_anexos(id, tarefa_id, storage_path, nome, tipo, tamanho, created_at)`,
    )
    .eq("id", id)
    .is("deleted_at", null)
    .order("concluida", { referencedTable: "subtarefas", ascending: true })
    .order("posicao", { referencedTable: "subtarefas", ascending: true })
    .order("created_at", { referencedTable: "subtarefas", ascending: true })
    .order("created_at", { referencedTable: "tarefa_comentarios", ascending: true })
    .single();

  if (error) throw error;

  const detail = data as unknown as TarefaDetail;
  if (detail.subtarefas?.length) {
    detail.subtarefas = sortSubtarefasList(detail.subtarefas);
  }
  return detail;
}

const SUBTAREFA_SELECT = `
  id, tarefa_id, titulo, concluida, posicao, created_at, criado_por, concluido_por,
  data_inicio, descricao, prioridade, lembretes,
  recorrencia, projeto_id, setor_id, visibilidade, updated_at,
  criador:profiles!subtarefas_criado_por_fkey(id, nome_completo, avatar_url),
  concluido_por_usuario:profiles!subtarefas_concluido_por_fkey(id, nome_completo, avatar_url),
  responsaveis:subtarefa_responsaveis(
    usuario_id,
    usuario:profiles!subtarefa_responsaveis_usuario_id_fkey(id, nome_completo, avatar_url)
  )
`;

const SUBTAREFA_DETAIL_SELECT = `
  ${SUBTAREFA_SELECT},
  observadores:subtarefa_observadores(
    usuario_id,
    usuario:profiles!subtarefa_observadores_usuario_id_fkey(id, nome_completo, avatar_url)
  ),
  comentarios:subtarefa_comentarios(${COMENTARIO_SELECT}),
  anexos:subtarefa_anexos(id, subtarefa_id, storage_path, nome, tipo, tamanho, created_at),
  tarefa:tarefas!subtarefas_tarefa_id_fkey(id, titulo)
`;

/**
 * Subtarefas para Agenda (Hoje / Em breve / Visualizando).
 * - Padrão: responsável da subtarefa ou da tarefa pai; com Data; abertas.
 * - `somente_visualizando`: visíveis por herança da pai, sem ser responsável.
 */
export async function listSubtarefasAgenda(
  filters: SubtarefaAgendaFilters,
): Promise<SubtarefaAgendaItem[]> {
  const usuarioId = filters.usuario_id.trim();
  if (!usuarioId) return [];

  if (filters.somente_visualizando) {
    return listSubtarefasVisualizando(filters);
  }

  const [{ data: subLinks, error: subLinksError }, { data: tarefaLinks, error: tarefaLinksError }] =
    await Promise.all([
      supabase
        .from("subtarefa_responsaveis")
        .select("subtarefa_id")
        .eq("usuario_id", usuarioId),
      supabase
        .from("tarefa_responsaveis")
        .select("tarefa_id")
        .eq("usuario_id", usuarioId),
    ]);

  if (subLinksError) throw subLinksError;
  if (tarefaLinksError) throw tarefaLinksError;

  const subtarefaIds = [...new Set((subLinks ?? []).map((row) => row.subtarefa_id))];
  const tarefaIds = [...new Set((tarefaLinks ?? []).map((row) => row.tarefa_id))];

  if (subtarefaIds.length === 0 && tarefaIds.length === 0) return [];

  let query = supabase
    .from("subtarefas")
    .select(
      `
      ${SUBTAREFA_SELECT},
      setor:setores(id, nome, cor),
      projeto:projetos(id, nome),
      tarefa:tarefas!inner(id, titulo, concluida, deleted_at, setor_id, projeto_id)
    `,
    )
    .eq("concluida", false)
    .not("data_inicio", "is", null)
    .eq("tarefa.concluida", false)
    .is("tarefa.deleted_at", null)
    .order("data_inicio", { ascending: true });

  if (subtarefaIds.length > 0 && tarefaIds.length > 0) {
    query = query.or(`id.in.(${subtarefaIds.join(",")}),tarefa_id.in.(${tarefaIds.join(",")})`);
  } else if (subtarefaIds.length > 0) {
    query = query.in("id", subtarefaIds);
  } else {
    query = query.in("tarefa_id", tarefaIds);
  }

  return finalizeSubtarefasAgendaQuery(query, filters);
}

/** Subtarefas visíveis (RLS via pai) em que o usuário não é responsável. */
async function listSubtarefasVisualizando(
  filters: SubtarefaAgendaFilters,
): Promise<SubtarefaAgendaItem[]> {
  const usuarioId = filters.usuario_id.trim();

  const [
    { data: mySubLinks, error: mySubError },
    { data: myTarefaLinks, error: myTarefaError },
  ] = await Promise.all([
    supabase
      .from("subtarefa_responsaveis")
      .select("subtarefa_id")
      .eq("usuario_id", usuarioId),
    supabase
      .from("tarefa_responsaveis")
      .select("tarefa_id")
      .eq("usuario_id", usuarioId),
  ]);

  if (mySubError) throw mySubError;
  if (myTarefaError) throw myTarefaError;

  const excludeSubIds = new Set((mySubLinks ?? []).map((row) => row.subtarefa_id));
  const excludeTarefaIds = new Set((myTarefaLinks ?? []).map((row) => row.tarefa_id));

  let query = supabase
    .from("subtarefas")
    .select(
      `
      ${SUBTAREFA_SELECT},
      setor:setores(id, nome, cor),
      projeto:projetos(id, nome),
      tarefa:tarefas!inner(
        id, titulo, concluida, deleted_at, setor_id, projeto_id, criado_por, visibilidade
      )
    `,
    )
    .eq("concluida", false)
    .eq("tarefa.concluida", false)
    .is("tarefa.deleted_at", null)
    .neq("tarefa.visibilidade", "somente_para_mim")
    .order("created_at", { ascending: false });

  if (filters.atribuido_ids && filters.atribuido_ids.length > 0) {
    const { data: respLinks, error: respError } = await supabase
      .from("subtarefa_responsaveis")
      .select("subtarefa_id")
      .in("usuario_id", filters.atribuido_ids);
    if (respError) throw respError;
    const ids = [...new Set((respLinks ?? []).map((row) => row.subtarefa_id))];
    if (ids.length === 0) return [];
    query = query.in("id", ids);
  }

  const rows = await finalizeSubtarefasAgendaQuery(query, filters);

  return rows.filter((row) => {
    if (excludeSubIds.has(row.id)) return false;
    if (excludeTarefaIds.has(row.tarefa_id)) return false;
    if (row.criado_por === usuarioId) return false;
    if (row.responsaveis?.some((r) => r.usuario_id === usuarioId)) return false;
    return true;
  });
}

async function finalizeSubtarefasAgendaQuery(
  // PostgREST builder tipado de forma frouxa — filtros encadeados variam por modo.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  filters: SubtarefaAgendaFilters,
): Promise<SubtarefaAgendaItem[]> {
  const searchTerm = filters.search?.trim() ?? "";
  if (searchTerm.length >= 2) {
    const searchIds = await buscarSubtarefaIds(searchTerm);
    if (searchIds.length === 0) return [];
    query = query.in("id", searchIds);
  }

  if (filters.prioridade && filters.prioridade !== "all") {
    query = query.eq("prioridade", filters.prioridade);
  }

  const de = filters.data_inicio_de?.trim() ?? "";
  const ate = filters.data_inicio_ate?.trim() ?? "";
  if (filters.somente_atrasadas) {
    query = query
      .not("data_inicio", "is", null)
      .lt("data_inicio", startOfTodayLocal().toISOString());
  } else if (de || ate) {
    const from = de || ate;
    const to = ate || de;
    const { startIso, endIso } = localDateRangeToIsoBounds(from, to);
    query = query.gte("data_inicio", startIso).lte("data_inicio", endIso);
  }

  const { data, error } = await query;
  if (error) throw error;

  const setorFilter =
    filters.setor_id && filters.setor_id !== "all" ? filters.setor_id : null;
  const projetoFilter =
    filters.projeto_id && filters.projeto_id !== "all" ? filters.projeto_id : null;

  return ((data ?? []) as unknown as Array<
    SubtarefaAgendaItem & {
      tarefa: {
        id: string;
        titulo: string;
        concluida: boolean;
        deleted_at: string | null;
        setor_id: string | null;
        projeto_id: string | null;
      } | null;
    }
  >)
    .filter((row) => {
      if (setorFilter) {
        const setorId = row.setor_id ?? row.tarefa?.setor_id ?? null;
        if (setorId !== setorFilter) return false;
      }
      if (projetoFilter) {
        const projetoId = row.projeto_id ?? row.tarefa?.projeto_id ?? null;
        if (projetoId !== projetoFilter) return false;
      }
      return true;
    })
    .map((row) => ({
      ...row,
      tarefa: row.tarefa ? { id: row.tarefa.id, titulo: row.tarefa.titulo } : null,
    }));
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

async function syncSubtarefaObservadores(
  subtarefaId: string,
  usuarioIds: string[],
): Promise<void> {
  const unique = [...new Set(usuarioIds.filter(Boolean))];

  const { error: deleteError } = await supabase
    .from("subtarefa_observadores")
    .delete()
    .eq("subtarefa_id", subtarefaId);
  if (deleteError) throw deleteError;

  if (unique.length === 0) return;

  const { error: insertError } = await supabase.from("subtarefa_observadores").insert(
    unique.map((usuario_id) => ({
      subtarefa_id: subtarefaId,
      usuario_id,
    })),
  );
  if (insertError) throw insertError;
}

export async function getSubtarefaDetail(id: string): Promise<SubtarefaDetail> {
  const { data, error } = await supabase
    .from("subtarefas")
    .select(SUBTAREFA_DETAIL_SELECT)
    .eq("id", id)
    .order("created_at", { referencedTable: "subtarefa_comentarios", ascending: true })
    .single();
  if (error) throw error;
  return data as unknown as SubtarefaDetail;
}

async function getSubtarefaRow(id: string): Promise<SubtarefaWithAuthors> {
  const { data, error } = await supabase
    .from("subtarefas")
    .select(SUBTAREFA_SELECT)
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as unknown as SubtarefaWithAuthors;
}

export async function createSubtarefa(
  tarefaId: string,
  titulo: string,
): Promise<SubtarefaWithAuthors> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  const { data: existing, error: existingError } = await supabase
    .from("subtarefas")
    .select("posicao")
    .eq("tarefa_id", tarefaId)
    .order("posicao", { ascending: false })
    .limit(1);
  if (existingError) throw existingError;

  const nextPosicao = (existing?.[0]?.posicao ?? -1) + 1;

  const { data, error } = await supabase
    .from("subtarefas")
    .insert({
      tarefa_id: tarefaId,
      titulo,
      criado_por: user.id,
      posicao: nextPosicao,
    })
    .select(SUBTAREFA_SELECT)
    .single();

  if (error) throw error;
  return data as unknown as SubtarefaWithAuthors;
}

function tituloComSufixoCopia(titulo: string): string {
  const base = titulo.trim();
  return base.endsWith("(cópia)") ? base : `${base} (cópia)`;
}

async function insertSubtarefaCopia(params: {
  source: SubtarefaWithAuthors & {
    observadores?: { usuario_id: string }[];
  };
  tarefaId: string;
  userId: string;
  withTituloCopia: boolean;
  posicao: number;
}): Promise<string> {
  const { source, tarefaId, userId, withTituloCopia, posicao } = params;
  const newId = crypto.randomUUID();

  const { error } = await supabase.from("subtarefas").insert({
    id: newId,
    tarefa_id: tarefaId,
    titulo: withTituloCopia ? tituloComSufixoCopia(source.titulo) : source.titulo,
    descricao: source.descricao,
    prioridade: source.prioridade,
    data_inicio: source.data_inicio,
    projeto_id: source.projeto_id,
    setor_id: source.setor_id,
    visibilidade: source.visibilidade,
    lembretes: source.lembretes,
    recorrencia: source.recorrencia,
    concluida: false,
    concluido_por: null,
    criado_por: userId,
    posicao,
  });
  if (error) throw error;

  const responsavelIds = (source.responsaveis ?? []).map((r) => r.usuario_id).filter(Boolean);
  if (responsavelIds.length > 0) {
    await syncSubtarefaResponsaveis(newId, responsavelIds);
  }

  const observadorIds = (source.observadores ?? []).map((r) => r.usuario_id).filter(Boolean);
  if (source.visibilidade === "pessoas_especificas" && observadorIds.length > 0) {
    await syncSubtarefaObservadores(newId, observadorIds);
  }

  return newId;
}

/** Duplica tarefa (campos principais + subtarefas). Sem anexos/comentários. */
export async function duplicateTarefa(id: string): Promise<TarefaWithRelations> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  const source = await getTarefaDetail(id);
  const newId = crypto.randomUUID();
  const responsavelIds =
    source.responsaveis?.map((r) => r.usuario_id).filter(Boolean) ??
    (source.atribuido_a ? [source.atribuido_a] : []);

  if (responsavelIds.length === 0) {
    throw new Error("A tarefa original não possui responsáveis para copiar.");
  }

  const { error } = await supabase.from("tarefas").insert({
    id: newId,
    titulo: tituloComSufixoCopia(source.titulo),
    descricao: source.descricao,
    projeto_id: source.projeto_id,
    setor_id: source.setor_id,
    atribuido_a: primaryAtribuido(responsavelIds),
    prioridade: source.prioridade,
    concluida: false,
    data_inicio: source.data_inicio,
    tags: source.tags,
    recorrencia: source.recorrencia,
    visibilidade: source.visibilidade,
    lembretes: source.lembretes,
    criado_por: user.id,
  });
  if (error) throw error;

  await syncResponsaveis(newId, responsavelIds);

  if (source.visibilidade === "pessoas_especificas") {
    const observadorIds = (source.observadores ?? []).map((r) => r.usuario_id).filter(Boolean);
    await syncObservadores(newId, observadorIds);
  }

  const subtarefas = sortSubtarefasList(source.subtarefas ?? []);
  for (let index = 0; index < subtarefas.length; index++) {
    await insertSubtarefaCopia({
      source: subtarefas[index],
      tarefaId: newId,
      userId: user.id,
      withTituloCopia: false,
      posicao: index,
    });
  }

  return getTarefa(newId);
}

/** Duplica subtarefa na mesma tarefa (sem anexos/comentários). */
export async function duplicateSubtarefa(id: string): Promise<SubtarefaWithAuthors> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  const source = await getSubtarefaDetail(id);

  const { data: existing, error: existingError } = await supabase
    .from("subtarefas")
    .select("posicao")
    .eq("tarefa_id", source.tarefa_id)
    .order("posicao", { ascending: false })
    .limit(1);
  if (existingError) throw existingError;

  const nextPosicao = (existing?.[0]?.posicao ?? -1) + 1;
  const newId = await insertSubtarefaCopia({
    source,
    tarefaId: source.tarefa_id,
    userId: user.id,
    withTituloCopia: true,
    posicao: nextPosicao,
  });

  return getSubtarefaRow(newId);
}

/** Altera apenas Projeto e/ou Setor da tarefa (preserva filhos, anexos e comentários). */
export async function moveTarefa(
  id: string,
  destino: { projeto_id: string | null; setor_id: string | null },
): Promise<TarefaWithRelations> {
  const { error } = await supabase
    .from("tarefas")
    .update({
      projeto_id: destino.projeto_id,
      setor_id: destino.setor_id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .is("deleted_at", null);

  if (error) throw error;
  return getTarefa(id);
}

/** Move subtarefa para outra tarefa (preserva anexos e comentários). */
export async function moveSubtarefa(
  id: string,
  destinoTarefaId: string,
): Promise<SubtarefaWithAuthors> {
  if (!destinoTarefaId) throw new Error("Selecione a tarefa de destino.");

  const { data: existing, error: existingError } = await supabase
    .from("subtarefas")
    .select("posicao")
    .eq("tarefa_id", destinoTarefaId)
    .order("posicao", { ascending: false })
    .limit(1);
  if (existingError) throw existingError;

  const nextPosicao = (existing?.[0]?.posicao ?? -1) + 1;

  const { error } = await supabase
    .from("subtarefas")
    .update({
      tarefa_id: destinoTarefaId,
      posicao: nextPosicao,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw error;
  return getSubtarefaRow(id);
}

/** Reordena subtarefas da mesma tarefa (ordem compartilhada). */
export async function reorderSubtarefas(
  tarefaId: string,
  orderedIds: string[],
): Promise<void> {
  if (!orderedIds.length) return;

  const { data: rows, error: fetchError } = await supabase
    .from("subtarefas")
    .select("id")
    .eq("tarefa_id", tarefaId)
    .in("id", orderedIds);
  if (fetchError) throw fetchError;

  const allowed = new Set((rows ?? []).map((r) => r.id));
  const payload = orderedIds
    .filter((id) => allowed.has(id))
    .map((id, index) => ({ id, posicao: index }));

  const results = await Promise.all(
    payload.map(({ id, posicao }) =>
      supabase.from("subtarefas").update({ posicao }).eq("id", id).eq("tarefa_id", tarefaId),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

export async function toggleSubtarefa(
  id: string,
  concluida: boolean,
): Promise<SubtarefaWithAuthors> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  const { data: current, error: currentError } = await supabase
    .from("subtarefas")
    .select("concluida, titulo, tarefa_id")
    .eq("id", id)
    .single();
  if (currentError) throw currentError;

  const { data, error } = await supabase
    .from("subtarefas")
    .update({
      concluida,
      concluido_por: concluida ? user.id : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(SUBTAREFA_SELECT)
    .single();

  if (error) throw error;

  if (concluida && !current.concluida) {
    const [ator, stakeholders, { data: tarefa }] = await Promise.all([
      getCurrentActor(),
      getSubtarefaStakeholderIds(id),
      supabase.from("tarefas").select("titulo").eq("id", current.tarefa_id).single(),
    ]);
    await notifyTarefaSubtarefaConcluida({
      usuarioIds: stakeholders.filter((uid) => uid !== user.id),
      tarefaId: current.tarefa_id,
      titulo: tarefa?.titulo ?? "tarefa",
      atorNome: ator?.nome ?? "Alguém",
      subtarefaId: id,
      subtarefaTitulo: current.titulo,
    }).catch(() => undefined);
  }

  return data as unknown as SubtarefaWithAuthors;
}

export async function updateSubtarefaTitulo(
  id: string,
  titulo: string,
): Promise<SubtarefaWithAuthors> {
  const trimmed = titulo.trim();
  if (!trimmed) throw new Error("Informe o texto da subtarefa.");

  const { error } = await supabase
    .from("subtarefas")
    .update({ titulo: trimmed, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
  return getSubtarefaRow(id);
}

export async function updateSubtarefaMeta(
  id: string,
  meta: {
    data_inicio?: string | null;
    atribuido_ids?: string[];
    visibilidade?: SubtarefaWithAuthors["visibilidade"];
  },
): Promise<SubtarefaWithAuthors> {
  const { data: anterior, error: anteriorError } = await supabase
    .from("subtarefas")
    .select("data_inicio, titulo, tarefa_id")
    .eq("id", id)
    .single();
  if (anteriorError) throw anteriorError;

  const patch: {
    data_inicio?: string | null;
    visibilidade?: SubtarefaWithAuthors["visibilidade"];
    updated_at?: string;
  } = {};

  if (meta.data_inicio !== undefined) {
    patch.data_inicio = meta.data_inicio;
  }
  if (meta.visibilidade !== undefined) {
    patch.visibilidade = meta.visibilidade;
  }

  if (Object.keys(patch).length > 0) {
    patch.updated_at = new Date().toISOString();
    const { error } = await supabase.from("subtarefas").update(patch).eq("id", id);
    if (error) throw error;
  }

  if (meta.atribuido_ids !== undefined) {
    await syncSubtarefaResponsaveis(id, meta.atribuido_ids);
  }

  const row = await getSubtarefaRow(id);

  if (
    meta.data_inicio !== undefined &&
    toLocalDateKey(anterior?.data_inicio) !== toLocalDateKey(meta.data_inicio)
  ) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const [ator, stakeholders, { data: tarefa }] = await Promise.all([
      getCurrentActor(),
      getSubtarefaStakeholderIds(id),
      supabase.from("tarefas").select("titulo").eq("id", anterior.tarefa_id).single(),
    ]);
    const alvos = stakeholders.filter((uid) => uid !== (user?.id ?? ator?.id));
    if (alvos.length > 0) {
      await notifySubtarefaPrazo({
        usuarioIds: alvos,
        tarefaId: anterior.tarefa_id,
        subtarefaId: id,
        titulo: anterior.titulo,
        tarefaTitulo: tarefa?.titulo ?? "tarefa",
        atorNome: ator?.nome ?? "Alguém",
        dataInicio: meta.data_inicio,
      }).catch(() => undefined);
    }
  }

  return row;
}

export async function updateSubtarefa(
  id: string,
  payload: SubtarefaFormData,
): Promise<SubtarefaDetail> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  const { data: anterior, error: anteriorError } = await supabase
    .from("subtarefas")
    .select("data_inicio, titulo, tarefa_id")
    .eq("id", id)
    .single();
  if (anteriorError) throw anteriorError;

  const patch = {
    titulo: payload.titulo.trim(),
    descricao: payload.descricao || null,
    projeto_id: payload.projeto_id,
    setor_id: payload.setor_id,
    prioridade: payload.prioridade,
    data_inicio: payload.data_inicio,
    visibilidade: payload.visibilidade,
    lembretes: payload.lembretes as unknown as Json,
    recorrencia: serializeRecorrencia(payload.recorrencia) as Json | null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("subtarefas").update(patch).eq("id", id);
  if (error) throw error;

  await syncSubtarefaResponsaveis(id, payload.atribuido_ids);
  if (payload.visibilidade === "pessoas_especificas") {
    await syncSubtarefaObservadores(id, payload.observador_ids);
  } else {
    await syncSubtarefaObservadores(id, []);
  }

  if (toLocalDateKey(anterior.data_inicio) !== toLocalDateKey(payload.data_inicio)) {
    const [ator, stakeholders, { data: tarefa }] = await Promise.all([
      getCurrentActor(),
      getSubtarefaStakeholderIds(id),
      supabase.from("tarefas").select("titulo").eq("id", anterior.tarefa_id).single(),
    ]);
    const alvos = stakeholders.filter((uid) => uid !== user.id);
    if (alvos.length > 0) {
      await notifySubtarefaPrazo({
        usuarioIds: alvos,
        tarefaId: anterior.tarefa_id,
        subtarefaId: id,
        titulo: payload.titulo.trim() || anterior.titulo,
        tarefaTitulo: tarefa?.titulo ?? "tarefa",
        atorNome: ator?.nome ?? "Alguém",
        dataInicio: payload.data_inicio,
      }).catch(() => undefined);
    }
  }

  return getSubtarefaDetail(id);
}

export async function deleteSubtarefa(id: string): Promise<void> {
  const { error } = await supabase.from("subtarefas").delete().eq("id", id);
  if (error) throw error;
}

export async function createSubtarefaComentario(
  subtarefaId: string,
  conteudo: string,
  parentId: string | null = null,
): Promise<SubtarefaComentario> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  if (parentId) {
    const { data: parent, error: parentError } = await supabase
      .from("subtarefa_comentarios")
      .select("id, parent_id, subtarefa_id")
      .eq("id", parentId)
      .single();
    if (parentError || !parent) throw new Error("Comentário original não encontrado.");
    if (parent.subtarefa_id !== subtarefaId) {
      throw new Error("Comentário inválido para esta subtarefa.");
    }
    if (parent.parent_id) throw new Error("Apenas um nível de resposta é permitido.");
  }

  const { data, error } = await supabase
    .from("subtarefa_comentarios")
    .insert({
      subtarefa_id: subtarefaId,
      usuario_id: user.id,
      conteudo,
      parent_id: parentId,
    })
    .select(COMENTARIO_SELECT)
    .single();

  if (error) throw error;
  const comentario = data as SubtarefaComentario;

  const [{ data: subtarefa }, ator, mencionaveis] = await Promise.all([
    supabase.from("subtarefas").select("titulo, tarefa_id").eq("id", subtarefaId).single(),
    getCurrentActor(),
    listSubtarefaMencionaveis(subtarefaId),
  ]);

  const mentionedIds = (await resolveMentionIds(conteudo, mencionaveis)).filter(
    (id) => id !== user.id,
  );

  if (mentionedIds.length > 0 && subtarefa) {
    const { data: tarefa } = await supabase
      .from("tarefas")
      .select("titulo")
      .eq("id", subtarefa.tarefa_id)
      .single();

    await notifySubtarefaMencao({
      usuarioIds: mentionedIds,
      tarefaId: subtarefa.tarefa_id,
      subtarefaId,
      comentarioId: comentario.id,
      tarefaTitulo: tarefa?.titulo ?? "tarefa",
      subtarefaTitulo: subtarefa.titulo ?? "subtarefa",
      atorNome: ator?.nome ?? "Alguém",
    }).catch(() => undefined);
  }

  return comentario;
}

export async function deleteSubtarefaComentario(id: string): Promise<void> {
  const { error } = await supabase.from("subtarefa_comentarios").delete().eq("id", id);
  if (error) throw error;
}

export async function updateSubtarefaComentario(
  id: string,
  conteudo: string,
): Promise<SubtarefaComentario> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  const trimmed = conteudo.trim();
  if (!trimmed) throw new Error("Comentário não pode ficar vazio.");

  const { data, error } = await supabase
    .from("subtarefa_comentarios")
    .update({
      conteudo: trimmed,
      editado_em: new Date().toISOString(),
      editado_por: user.id,
    })
    .eq("id", id)
    .select(COMENTARIO_SELECT)
    .single();

  if (error) throw error;
  return data as SubtarefaComentario;
}

export async function createTarefaComentario(
  tarefaId: string,
  conteudo: string,
  parentId: string | null = null,
): Promise<TarefaComentario> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  if (parentId) {
    const { data: parent, error: parentError } = await supabase
      .from("tarefa_comentarios")
      .select("id, parent_id, usuario_id, tarefa_id")
      .eq("id", parentId)
      .single();
    if (parentError || !parent) throw new Error("Comentário original não encontrado.");
    if (parent.tarefa_id !== tarefaId) throw new Error("Comentário inválido para esta tarefa.");
    if (parent.parent_id) throw new Error("Apenas um nível de resposta é permitido.");
  }

  const { data, error } = await supabase
    .from("tarefa_comentarios")
    .insert({
      tarefa_id: tarefaId,
      usuario_id: user.id,
      conteudo,
      parent_id: parentId,
    })
    .select(COMENTARIO_SELECT)
    .single();

  if (error) throw error;
  const comentario = data as TarefaComentario;

  const [{ data: tarefa }, ator, mencionaveis] = await Promise.all([
    supabase.from("tarefas").select("criado_por, titulo").eq("id", tarefaId).single(),
    getCurrentActor(),
    listTarefaMencionaveis(tarefaId),
  ]);

  const atorNome = ator?.nome ?? "Alguém";
  const titulo = tarefa?.titulo ?? "tarefa";
  const mentionedIds = (
    await resolveMentionIds(conteudo, mencionaveis)
  ).filter((id) => id !== user.id);

  const jobs: Promise<unknown>[] = [];

  if (parentId) {
    const { data: parent } = await supabase
      .from("tarefa_comentarios")
      .select("usuario_id")
      .eq("id", parentId)
      .single();
    if (parent?.usuario_id && parent.usuario_id !== user.id) {
      jobs.push(
        notifyTarefaResposta({
          usuarioIds: [parent.usuario_id],
          tarefaId,
          titulo,
          comentarioId: comentario.id,
          atorNome,
        }),
      );
    }
  } else {
    const stakeholders = await getTarefaStakeholderIds(tarefaId);
    const comentarioOnly = stakeholders.filter(
      (id) => id !== user.id && !mentionedIds.includes(id),
    );
    if (comentarioOnly.length > 0) {
      jobs.push(
        notifyTarefaComentario({
          usuarioIds: comentarioOnly,
          tarefaId,
          titulo,
          comentarioId: comentario.id,
          atorNome,
        }),
      );
    }
  }

  if (mentionedIds.length > 0) {
    jobs.push(
      notifyTarefaMencao({
        usuarioIds: mentionedIds,
        tarefaId,
        comentarioId: comentario.id,
        atorNome,
      }),
    );
  }

  void Promise.all(jobs.map((job) => job.catch(() => undefined)));

  return comentario;
}

export async function deleteTarefaComentario(id: string): Promise<void> {
  const { error } = await supabase.from("tarefa_comentarios").delete().eq("id", id);
  if (error) throw error;
}

export async function updateTarefaComentario(
  id: string,
  conteudo: string,
): Promise<TarefaComentario> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  const trimmed = conteudo.trim();
  if (!trimmed) throw new Error("Comentário não pode ficar vazio.");

  const { data, error } = await supabase
    .from("tarefa_comentarios")
    .update({
      conteudo: trimmed,
      editado_em: new Date().toISOString(),
      editado_por: user.id,
    })
    .eq("id", id)
    .select(COMENTARIO_SELECT)
    .single();

  if (error) throw error;
  return data as TarefaComentario;
}

export async function getDashboardKpis(): Promise<DashboardKpis> {
  const hojeInicio = startOfDay(new Date()).toISOString();
  const hojeFim = endOfDay(new Date()).toISOString();

  const [tarefasRes, setoresRes, pessoasRes] = await Promise.all([
    supabase
      .from("tarefas")
      .select("concluida, data_inicio")
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
    tarefasAbertas: tarefas.filter((t) => !t.concluida).length,
    tarefasConcluidas: tarefas.filter((t) => t.concluida).length,
    tarefasVencendoHoje: tarefas.filter(
      (t) =>
        t.data_inicio &&
        t.data_inicio >= hojeInicio &&
        t.data_inicio <= hojeFim &&
        !t.concluida,
    ).length,
    totalSetores: setoresRes.count ?? 0,
    totalPessoas: pessoasRes.count ?? 0,
  };
}
