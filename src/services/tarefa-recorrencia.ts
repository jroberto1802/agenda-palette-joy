import {
  calcularProximaOcorrenciaPrevista,
  expandirDatasOcorrencia,
  getAncoraSerie,
  isSerieModelo,
  offsetDiasSubtarefaNoCiclo,
  parseRecorrencia,
  serializeRecorrencia,
} from "@/utils/recorrencia";
import { addDays, endOfDay, startOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { RecorrenciaConfig, TarefaFormData, TarefaWithRelations } from "@/types";
import { toLocalDateKey } from "@/utils/agenda-datas";

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

async function syncResponsaveis(tarefaId: string, usuarioIds: string[]) {
  await supabase.from("tarefa_responsaveis").delete().eq("tarefa_id", tarefaId);
  if (usuarioIds.length === 0) return;
  const { error } = await supabase.from("tarefa_responsaveis").insert(
    usuarioIds.map((usuario_id) => ({ tarefa_id: tarefaId, usuario_id })),
  );
  if (error) throw error;
}

async function syncObservadores(tarefaId: string, usuarioIds: string[]) {
  await supabase.from("tarefa_observadores").delete().eq("tarefa_id", tarefaId);
  if (usuarioIds.length === 0) return;
  const { error } = await supabase.from("tarefa_observadores").insert(
    usuarioIds.map((usuario_id) => ({ tarefa_id: tarefaId, usuario_id })),
  );
  if (error) throw error;
}

function primaryAtribuido(ids: string[]): string | null {
  return ids[0] ?? null;
}

/** Prefixo ISO para comparar dia civil (YYYY-MM-DD). */
function dayPrefix(iso: string | null | undefined): string | null {
  return toLocalDateKey(iso);
}

type ModeloSubtarefaTemplate = {
  id: string;
  titulo: string;
  prioridade: TarefaWithRelations["prioridade"];
  data_inicio: string | null;
  setor_id: string | null;
  projeto_id: string | null;
};

/**
 * Após criar a ocorrência da tarefa, gera UM conjunto de subtarefas filhas.
 * Data = data da ocorrência + offset (sem recorrência própria).
 */
async function cloneSubtarefasDoModelo(
  modeloId: string,
  ocorrenciaId: string,
  ancoraIsoOrKey: string | null,
  ocorrenciaDataInicio: string,
  config: RecorrenciaConfig | null,
): Promise<void> {
  const { data: subtarefas, error } = await supabase
    .from("subtarefas")
    .select(
      "titulo, descricao, prioridade, data_inicio, projeto_id, setor_id, visibilidade, lembretes, posicao",
    )
    .eq("tarefa_id", modeloId)
    .order("posicao", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!subtarefas?.length) return;

  const ocorrenciaDay = startOfDay(new Date(ocorrenciaDataInicio));

  const rows = subtarefas.map((s) => {
    let dataInicio: string | null = null;
    if (s.data_inicio && config) {
      const offset = offsetDiasSubtarefaNoCiclo(s.data_inicio, ancoraIsoOrKey, config);
      if (offset !== null) {
        dataInicio = addDays(ocorrenciaDay, offset).toISOString();
      }
    }

    return {
      id: crypto.randomUUID(),
      tarefa_id: ocorrenciaId,
      titulo: s.titulo,
      descricao: s.descricao,
      prioridade: s.prioridade,
      data_inicio: dataInicio,
      projeto_id: s.projeto_id,
      setor_id: s.setor_id,
      visibilidade: s.visibilidade,
      lembretes: s.lembretes,
      // Subtarefas nunca têm recorrência própria
      recorrencia: null,
      posicao: s.posicao,
      concluida: false,
      concluido_por: null,
    };
  });

  const { error: insertError } = await supabase.from("subtarefas").insert(rows);
  if (insertError) throw insertError;
}

async function materializarOcorrencia(
  modelo: TarefaWithRelations,
  dataInicioIso: string,
): Promise<TarefaWithRelations | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const responsavelIds =
    modelo.responsaveis?.map((r) => r.usuario_id).filter(Boolean) ??
    (modelo.atribuido_a ? [modelo.atribuido_a] : []);

  const observadorIds =
    modelo.observadores?.map((o) => o.usuario_id).filter(Boolean) ?? [];

  const novaId = crypto.randomUUID();
  const serieRaizId = modelo.serie_raiz_id === modelo.id ? modelo.id : (modelo.serie_raiz_id ?? modelo.id);
  const config = parseRecorrencia(modelo.recorrencia);
  const ancora = getAncoraSerie(modelo, config);

  const { data, error } = await supabase
    .from("tarefas")
    .insert({
      id: novaId,
      titulo: modelo.titulo,
      descricao: modelo.descricao,
      projeto_id: modelo.projeto_id,
      setor_id: modelo.setor_id,
      atribuido_a: primaryAtribuido(responsavelIds),
      prioridade: modelo.prioridade,
      concluida: false,
      data_inicio: dataInicioIso,
      tags: modelo.tags,
      recorrencia: null,
      serie_raiz_id: serieRaizId,
      visibilidade: modelo.visibilidade,
      lembretes: modelo.lembretes,
      criado_por: user.id,
    })
    .select(TAREFA_SELECT)
    .single();

  if (error) throw error;

  if (responsavelIds.length > 0) await syncResponsaveis(novaId, responsavelIds);
  if (observadorIds.length > 0) await syncObservadores(novaId, observadorIds);

  await cloneSubtarefasDoModelo(
    serieRaizId,
    novaId,
    ancora,
    dataInicioIso,
    config,
  ).catch(() => undefined);

  return data as TarefaWithRelations;
}

/** Atualiza `data_inicio` do modelo para a próxima ocorrência prevista. */
export async function atualizarProximaDataModelo(modeloId: string): Promise<void> {
  const { data: modelo, error } = await supabase
    .from("tarefas")
    .select("id, data_inicio, recorrencia, serie_raiz_id")
    .eq("id", modeloId)
    .single();
  if (error || !modelo) return;

  const config = parseRecorrencia(modelo.recorrencia);
  if (!config || !isSerieModelo(modelo)) return;

  const ancora = getAncoraSerie(modelo, config);
  const proxima = calcularProximaOcorrenciaPrevista(ancora, config, new Date());
  const proximaIso = proxima ? proxima.toISOString() : null;

  // Garante data_ancora na regra
  const ancoraKey = toLocalDateKey(ancora) ?? ancora;
  const nextConfig: RecorrenciaConfig = {
    ...config,
    data_ancora: config.data_ancora ?? ancoraKey,
  };

  await supabase
    .from("tarefas")
    .update({
      data_inicio: proximaIso,
      recorrencia: serializeRecorrencia(nextConfig),
      concluida: false,
      data_conclusao: null,
    })
    .eq("id", modeloId);
}

/**
 * Reabre modelos concluídos (modelo é permanente) e materializa ocorrências devidas.
 * O modelo NÃO conta como ocorrência — só linhas filhas (`serie_raiz_id !== id`).
 */
export async function materializarOcorrenciasDevidas(): Promise<number> {
  const hoje = startOfDay(new Date());
  const hojeFim = endOfDay(hoje);

  const { data: candidatas, error } = await supabase
    .from("tarefas")
    .select(TAREFA_SELECT)
    .is("deleted_at", null)
    .not("recorrencia", "is", null)
    .not("serie_raiz_id", "is", null);

  if (error) throw error;

  const modelosSerie = ((candidatas ?? []) as TarefaWithRelations[]).filter((t) =>
    isSerieModelo(t),
  );

  let criadas = 0;

  for (const modelo of modelosSerie) {
    if (modelo.concluida) {
      await supabase
        .from("tarefas")
        .update({ concluida: false, data_conclusao: null })
        .eq("id", modelo.id);
    }

    const config = parseRecorrencia(modelo.recorrencia);
    if (!config) continue;

    // Persist âncora se ainda não existir
    if (!config.data_ancora && modelo.data_inicio) {
      const ancoraKey = toLocalDateKey(modelo.data_inicio);
      if (ancoraKey) {
        await supabase
          .from("tarefas")
          .update({
            recorrencia: serializeRecorrencia({ ...config, data_ancora: ancoraKey }),
          })
          .eq("id", modelo.id);
        config.data_ancora = ancoraKey;
      }
    }

    const ancora = getAncoraSerie(modelo, config);
    const de = ancora ? startOfDay(new Date(ancora.includes("T") ? ancora : ancora + "T12:00:00")) : addDays(hoje, -365);
    const datas = expandirDatasOcorrencia(
      ancora?.includes("T") ? ancora : ancora ? `${ancora}T12:00:00` : null,
      config,
      de,
      hojeFim,
      { max: 400 },
    );

    const { data: existentes } = await supabase
      .from("tarefas")
      .select("id, data_inicio, serie_raiz_id")
      .eq("serie_raiz_id", modelo.id)
      .is("deleted_at", null)
      .neq("id", modelo.id); // só ocorrências, nunca o modelo

    const diasExistentes = new Set(
      (existentes ?? [])
        .map((e) => dayPrefix(e.data_inicio))
        .filter((d): d is string => !!d),
    );

    for (const data of datas) {
      const key = toLocalDateKey(data)!;
      if (diasExistentes.has(key)) continue;
      if (data.getTime() > hojeFim.getTime()) continue;

      await materializarOcorrencia(modelo, data.toISOString());
      diasExistentes.add(key);
      criadas++;
    }

    await atualizarProximaDataModelo(modelo.id);
  }

  return criadas;
}

export type PrevisaoOcorrencia = {
  kind: "tarefa";
  serie_raiz_id: string;
  data_inicio: string;
  titulo: string;
  prioridade: TarefaWithRelations["prioridade"];
  setor: TarefaWithRelations["setor"];
  projeto: TarefaWithRelations["projeto"];
  previsao: true;
};

export type PrevisaoSubtarefa = {
  kind: "subtarefa";
  serie_raiz_id: string;
  modelo_subtarefa_id: string;
  data_inicio: string;
  titulo: string;
  tarefa_titulo: string;
  prioridade: TarefaWithRelations["prioridade"];
  setor: TarefaWithRelations["setor"];
  projeto: TarefaWithRelations["projeto"];
  previsao: true;
};

export type PrevisaoAgendaItem = PrevisaoOcorrencia | PrevisaoSubtarefa;

export type PrevisoesAgenda = {
  tarefas: PrevisaoOcorrencia[];
  subtarefas: PrevisaoSubtarefa[];
};

/**
 * Previsões futuras — Em Breve / Calendário.
 *
 * Recorrência: SOMENTE a tarefa principal.
 * Subtarefas: após cada ocorrência da tarefa, exatamente UM conjunto
 * (data = ocorrência + offset). Sem recorrência própria.
 */
export async function listPrevisoesOcorrencia(
  deIsoDate: string,
  ateIsoDate: string,
): Promise<PrevisoesAgenda> {
  const de = startOfDay(new Date(deIsoDate + "T12:00:00"));
  const ate = endOfDay(new Date(ateIsoDate + "T12:00:00"));
  const hojeFim = endOfDay(new Date());

  const { data: candidatas, error } = await supabase
    .from("tarefas")
    .select(TAREFA_SELECT)
    .is("deleted_at", null)
    .not("recorrencia", "is", null)
    .not("serie_raiz_id", "is", null);

  if (error) throw error;

  const modelos = ((candidatas ?? []) as TarefaWithRelations[]).filter((t) => isSerieModelo(t));
  const previsoesTarefa: PrevisaoOcorrencia[] = [];
  const previsoesSub: PrevisaoSubtarefa[] = [];

  for (const modelo of modelos) {
    const config = parseRecorrencia(modelo.recorrencia);
    if (!config) continue;

    const { data: existentes } = await supabase
      .from("tarefas")
      .select("id, data_inicio")
      .eq("serie_raiz_id", modelo.id)
      .is("deleted_at", null)
      .neq("id", modelo.id);

    const diasExistentes = new Set(
      (existentes ?? [])
        .map((e) => dayPrefix(e.data_inicio))
        .filter((d): d is string => !!d),
    );

    const ancora = getAncoraSerie(modelo, config);
    const ancoraKey = ancora ? toLocalDateKey(ancora) ?? ancora : null;
    const ancoraIso = ancoraKey ? `${ancoraKey}T12:00:00` : null;

    // Templates do modelo: só offsets fixos (+0, +1…), sem expandir recorrência neles
    const { data: templatesRaw } = await supabase
      .from("subtarefas")
      .select("id, titulo, prioridade, data_inicio, setor_id, projeto_id")
      .eq("tarefa_id", modelo.id);

    const templates = (templatesRaw ?? []) as ModeloSubtarefaTemplate[];
    const templatesComOffset: Array<{ template: ModeloSubtarefaTemplate; offset: number }> = [];
    for (const t of templates) {
      const offset = offsetDiasSubtarefaNoCiclo(t.data_inicio, ancora, config);
      if (offset === null) continue;
      templatesComOffset.push({ template: t, offset });
    }

    const maxOffset = templatesComOffset.length
      ? Math.max(...templatesComOffset.map((t) => t.offset))
      : 0;

    // 1) Datas da TAREFA PRINCIPAL (única coisa que usa o motor de recorrência)
    const expandDe = addDays(de, -maxOffset);
    const datasPai = expandirDatasOcorrencia(ancoraIso, config, expandDe, ate, {
      max: 60,
    });

    for (const dataPai of datasPai) {
      if (dataPai.getTime() <= hojeFim.getTime()) continue;
      const paiKey = toLocalDateKey(dataPai)!;
      if (diasExistentes.has(paiKey)) continue;

      const paiDay = startOfDay(dataPai);

      if (paiDay.getTime() >= de.getTime() && paiDay.getTime() <= ate.getTime()) {
        previsoesTarefa.push({
          kind: "tarefa",
          serie_raiz_id: modelo.id,
          data_inicio: dataPai.toISOString(),
          titulo: modelo.titulo,
          prioridade: modelo.prioridade,
          setor: modelo.setor,
          projeto: modelo.projeto,
          previsao: true,
        });
      }

      // 2) UM conjunto de subtarefas para ESTA ocorrência (sem recorrência)
      for (const { template, offset } of templatesComOffset) {
        const dataSub = addDays(paiDay, offset);
        if (dataSub.getTime() <= hojeFim.getTime()) continue;
        if (dataSub.getTime() < de.getTime() || dataSub.getTime() > ate.getTime()) {
          continue;
        }

        previsoesSub.push({
          kind: "subtarefa",
          serie_raiz_id: modelo.id,
          modelo_subtarefa_id: template.id,
          data_inicio: dataSub.toISOString(),
          titulo: template.titulo,
          tarefa_titulo: modelo.titulo,
          prioridade: template.prioridade,
          setor: modelo.setor,
          projeto: modelo.projeto,
          previsao: true,
        });
      }
    }
  }

  previsoesTarefa.sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));
  previsoesSub.sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));

  return { tarefas: previsoesTarefa, subtarefas: previsoesSub };
}

export type EscopoEdicaoSerie = "somente_esta" | "esta_e_futuras";

/** Atualiza recorrência do modelo (cria série se necessário). */
export async function setTarefaRecorrencia(
  tarefaId: string,
  config: RecorrenciaConfig | null,
): Promise<TarefaWithRelations> {
  const serialized = serializeRecorrencia(config);

  const { data: atual, error: loadError } = await supabase
    .from("tarefas")
    .select(TAREFA_SELECT)
    .eq("id", tarefaId)
    .single();
  if (loadError) throw loadError;

  const tarefa = atual as TarefaWithRelations;
  const raizId = tarefa.serie_raiz_id ?? tarefa.id;

  // Remover recorrência
  if (!serialized) {
    const modeloId = isSerieModelo(tarefa) ? tarefa.id : raizId;
    const { data, error } = await supabase
      .from("tarefas")
      .update({ recorrencia: null })
      .eq("id", modeloId)
      .select(TAREFA_SELECT)
      .single();
    if (error) throw error;
    // Mantém serie_raiz_id nas ocorrências existentes; só para de gerar novas
    return data as TarefaWithRelations;
  }

  // Definir / alterar regra no modelo
  let modeloId = tarefa.id;
  if (isSerieModelo(tarefa) || !tarefa.serie_raiz_id) {
    // Torna esta tarefa o modelo
    const { data, error } = await supabase
      .from("tarefas")
      .update({
        recorrencia: serialized,
        serie_raiz_id: tarefa.id,
      })
      .eq("id", tarefa.id)
      .select(TAREFA_SELECT)
      .single();
    if (error) throw error;
    return data as TarefaWithRelations;
  }

  // Edição a partir de uma ocorrência → atualiza o modelo
  modeloId = raizId;
  const { data, error } = await supabase
    .from("tarefas")
    .update({ recorrencia: serialized })
    .eq("id", modeloId)
    .select(TAREFA_SELECT)
    .single();
  if (error) throw error;
  return data as TarefaWithRelations;
}

/** Carrega a regra de recorrência do modelo da série. */
export async function getModeloRecorrencia(
  serieRaizId: string,
): Promise<RecorrenciaConfig | null> {
  const { data, error } = await supabase
    .from("tarefas")
    .select("recorrencia")
    .eq("id", serieRaizId)
    .maybeSingle();
  if (error) throw error;
  return parseRecorrencia(data?.recorrencia);
}

/** Aplica payload de formulário só nesta ocorrência ou também no modelo. */
export async function updateTarefaComEscopoSerie(
  id: string,
  payload: TarefaFormData,
  escopo: EscopoEdicaoSerie,
  updateTarefaFn: (id: string, payload: TarefaFormData) => Promise<TarefaWithRelations>,
): Promise<TarefaWithRelations> {
  const { data: row } = await supabase
    .from("tarefas")
    .select("id, serie_raiz_id, data_inicio, recorrencia")
    .eq("id", id)
    .single();

  const modeloId =
    row?.serie_raiz_id && row.serie_raiz_id !== id ? row.serie_raiz_id : id;
  const isModelo = modeloId === id;

  // Ocorrências nunca guardam a regra; no modelo, "somente esta" preserva a regra atual.
  const payloadOcorrencia: TarefaFormData = {
    ...payload,
    recorrencia: isModelo
      ? escopo === "esta_e_futuras"
        ? payload.recorrencia
        : parseRecorrencia(row?.recorrencia)
      : null,
  };

  const atualizada = await updateTarefaFn(id, payloadOcorrencia);

  if (escopo !== "esta_e_futuras") return atualizada;

  // Atualiza template do modelo (mantém data_inicio do modelo quando editando ocorrência)
  if (!isModelo) {
    await supabase
      .from("tarefas")
      .update({
        titulo: payload.titulo,
        descricao: payload.descricao || null,
        projeto_id: payload.projeto_id,
        setor_id: payload.setor_id,
        prioridade: payload.prioridade,
        tags: payload.tags,
        recorrencia: serializeRecorrencia(payload.recorrencia),
        visibilidade: payload.visibilidade,
        lembretes: payload.lembretes,
        serie_raiz_id: modeloId,
      })
      .eq("id", modeloId);
  } else if (!row?.serie_raiz_id) {
    await supabase.from("tarefas").update({ serie_raiz_id: id }).eq("id", id);
  }

  return atualizada;
}

export type EscopoExclusaoSerie = "somente_esta" | "futuras" | "serie_inteira";

export async function softDeleteTarefaComEscopo(
  id: string,
  escopo: EscopoExclusaoSerie,
): Promise<void> {
  const now = new Date().toISOString();
  const { data: tarefa, error } = await supabase
    .from("tarefas")
    .select("id, serie_raiz_id, data_inicio")
    .eq("id", id)
    .single();
  if (error) throw error;

  if (escopo === "somente_esta" || !tarefa.serie_raiz_id) {
    const { error: delError } = await supabase
      .from("tarefas")
      .update({ deleted_at: now })
      .eq("id", id);
    if (delError) throw delError;
    return;
  }

  const raiz = tarefa.serie_raiz_id;

  if (escopo === "serie_inteira") {
    const { error: delError } = await supabase
      .from("tarefas")
      .update({ deleted_at: now })
      .eq("serie_raiz_id", raiz)
      .is("deleted_at", null);
    if (delError) throw delError;
    return;
  }

  // futuras: esta ocorrência e as seguintes (data_inicio >= corte)
  const corte = tarefa.data_inicio ?? now;
  const { error: delFuturas } = await supabase
    .from("tarefas")
    .update({ deleted_at: now })
    .eq("serie_raiz_id", raiz)
    .gte("data_inicio", corte)
    .is("deleted_at", null);
  if (delFuturas) throw delFuturas;

  // Garante exclusão da atual mesmo sem data_inicio
  const { error: delEsta } = await supabase
    .from("tarefas")
    .update({ deleted_at: now })
    .eq("id", id)
    .is("deleted_at", null);
  if (delEsta) throw delEsta;

  // Remove regra do modelo para não gerar novas
  await supabase.from("tarefas").update({ recorrencia: null }).eq("id", raiz);
}
