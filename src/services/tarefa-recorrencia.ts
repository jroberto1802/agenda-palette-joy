import {
  expandirDatasOcorrencia,
  getAncoraSerie,
  getLimitePrevisaoFutura,
  isSerieModelo,
  dataSubtarefaNaOcorrencia,
  parseRecorrencia,
  serializeRecorrencia,
} from "@/utils/recorrencia";
import { endOfDay, startOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { RecorrenciaConfig, TarefaFormData, TarefaWithRelations } from "@/types";
import {
  applyTimeFromIso,
  localDateAtNoon,
  parseDayLocal,
  toLocalDateKey,
} from "@/utils/agenda-datas";

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
  dia_no_mes?: number | null;
  offset_dias?: number | null;
};

/**
 * Aponta o modelo da série para a próxima data devida que ainda não tem ocorrência.
 *
 * Roda no servidor (`security definer`): a ocorrência pode ser concluída por
 * alguém sem permissão de escrita no modelo, e o modelo precisa avançar mesmo assim.
 */
export async function atualizarProximaDataModelo(modeloId: string): Promise<void> {
  const { error } = await supabase.rpc("recorrencia_atualizar_proxima_data", {
    p_modelo_id: modeloId,
  });
  if (error) throw error;
}

/**
 * Materializa as ocorrências devidas (data <= hoje, America/Sao_Paulo) de todas
 * as séries ativas, com o conjunto de subtarefas de cada uma (offset em dias).
 *
 * A geração é do servidor: job diário às 00:05 (America/Sao_Paulo) e esta RPC
 * como catch-up quando o app abre. Rodar no servidor é o que garante:
 * - independência de alguém estar logado;
 * - autoria (`criado_por`) preservada do modelo, não de quem abriu o app;
 * - séries invisíveis para o usuário atual também sendo geradas;
 * - ausência de duplicidade (lock + checagem na mesma transação).
 *
 * @returns quantidade de ocorrências criadas nesta execução.
 */
export async function materializarOcorrenciasDevidas(): Promise<number> {
  const { data, error } = await supabase.rpc("materializar_ocorrencias_recorrencia", {});
  if (error) throw error;
  return typeof data === "number" ? data : 0;
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
 *
 * A janela é limitada a 1 ano à frente de hoje. Além disso nada é previsto,
 * mesmo com a série ativa — é limite de exibição, não de vigência da série.
 *
 * Performance: 3 queries no total (modelos + ocorrências existentes + templates),
 * sem N+1 por série — crítico para a navegação rápida da aba Em breve.
 */
export async function listPrevisoesOcorrencia(
  deIsoDate: string,
  ateIsoDate: string,
): Promise<PrevisoesAgenda> {
  const de = startOfDay(new Date(deIsoDate + "T12:00:00"));
  const ateSolicitado = endOfDay(new Date(ateIsoDate + "T12:00:00"));
  const hojeFim = endOfDay(new Date());
  const limitePrevisao = getLimitePrevisaoFutura();

  if (de.getTime() > limitePrevisao.getTime()) return { tarefas: [], subtarefas: [] };

  const ate =
    ateSolicitado.getTime() > limitePrevisao.getTime() ? limitePrevisao : ateSolicitado;

  // Select leve: só o necessário para montar o card de previsão.
  const { data: candidatas, error } = await supabase
    .from("tarefas")
    .select(
      `
      id, titulo, prioridade, recorrencia, data_inicio, serie_raiz_id,
      setor:setores(id, nome, cor),
      projeto:projetos(id, nome)
    `,
    )
    .is("deleted_at", null)
    .not("recorrencia", "is", null)
    .not("serie_raiz_id", "is", null);

  if (error) throw error;

  const modelos = ((candidatas ?? []) as TarefaWithRelations[]).filter((t) => isSerieModelo(t));
  if (modelos.length === 0) return { tarefas: [], subtarefas: [] };

  const modeloIds = modelos.map((m) => m.id);

  // Batch: todas as ocorrências existentes das séries + todos os templates de subtarefa
  const [{ data: existentesRaw, error: existentesError }, { data: templatesRaw, error: templatesError }] =
    await Promise.all([
      // Sem filtro de deleted_at: data já materializada uma vez não volta a ser
      // prevista, mesmo que a ocorrência tenha sido excluída depois.
      supabase
        .from("tarefas")
        .select("id, data_inicio, serie_raiz_id, recorrencia_data_origem")
        .in("serie_raiz_id", modeloIds),
      supabase
        .from("subtarefas")
        .select("id, tarefa_id, titulo, prioridade, data_inicio, setor_id, projeto_id, dia_no_mes, offset_dias")
        .in("tarefa_id", modeloIds),
    ]);

  if (existentesError) throw existentesError;
  if (templatesError) throw templatesError;

  const diasExistentesPorSerie = new Map<string, Set<string>>();
  for (const e of existentesRaw ?? []) {
    if (!e.serie_raiz_id || e.id === e.serie_raiz_id) continue; // ignora o próprio modelo
    // A data ocupada é a de ORIGEM da ocorrência: reagendar não libera a data
    // prevista para uma nova geração (fallback só para ocorrências legadas).
    const key = e.recorrencia_data_origem
      ? (toLocalDateKey(parseDayLocal(e.recorrencia_data_origem)) ?? null)
      : dayPrefix(e.data_inicio);
    if (!key) continue;
    let set = diasExistentesPorSerie.get(e.serie_raiz_id);
    if (!set) {
      set = new Set();
      diasExistentesPorSerie.set(e.serie_raiz_id, set);
    }
    set.add(key);
  }

  const templatesPorModelo = new Map<string, ModeloSubtarefaTemplate[]>();
  for (const t of (templatesRaw ?? []) as (ModeloSubtarefaTemplate & { tarefa_id: string })[]) {
    let list = templatesPorModelo.get(t.tarefa_id);
    if (!list) {
      list = [];
      templatesPorModelo.set(t.tarefa_id, list);
    }
    list.push(t);
  }

  const previsoesTarefa: PrevisaoOcorrencia[] = [];
  const previsoesSub: PrevisaoSubtarefa[] = [];

  for (const modelo of modelos) {
    const config = parseRecorrencia(modelo.recorrencia);
    if (!config) continue;

    const diasExistentes = diasExistentesPorSerie.get(modelo.id) ?? new Set<string>();
    const templates = templatesPorModelo.get(modelo.id) ?? [];

    const ancora = getAncoraSerie(modelo, config);
    const ancoraKey = ancora ? toLocalDateKey(ancora) ?? ancora : null;

    // 1) Datas da TAREFA PRINCIPAL (única coisa que usa o motor de recorrência)
    const datasPai = expandirDatasOcorrencia(ancoraKey, config, de, ate, {
      max: 60,
    });

    for (const dataPai of datasPai) {
      if (dataPai.getTime() <= hojeFim.getTime()) continue;
      const paiKey = toLocalDateKey(dataPai)!;
      if (diasExistentes.has(paiKey)) continue;

      const paiDay = startOfDay(dataPai);
      const paiComHora = applyTimeFromIso(localDateAtNoon(paiDay), modelo.data_inicio);

      if (paiDay.getTime() >= de.getTime() && paiDay.getTime() <= ate.getTime()) {
        previsoesTarefa.push({
          kind: "tarefa",
          serie_raiz_id: modelo.id,
          data_inicio: paiComHora.toISOString(),
          titulo: modelo.titulo,
          prioridade: modelo.prioridade,
          setor: modelo.setor,
          projeto: modelo.projeto,
          previsao: true,
        });
      }

      // 2) UM conjunto de subtarefas para ESTA ocorrência
      for (const template of templates) {
        const dataSub = dataSubtarefaNaOcorrencia(paiDay, config, template, ancora);
        if (!dataSub) continue;
        if (dataSub.getTime() <= hojeFim.getTime()) continue;
        if (dataSub.getTime() < de.getTime() || dataSub.getTime() > ate.getTime()) {
          continue;
        }

        previsoesSub.push({
          kind: "subtarefa",
          serie_raiz_id: modelo.id,
          modelo_subtarefa_id: template.id,
          data_inicio: applyTimeFromIso(dataSub, template.data_inicio).toISOString(),
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
