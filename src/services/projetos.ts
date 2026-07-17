import { supabase } from "@/integrations/supabase/client";
import type { ProjetoFormData, ProjetoMembro, ProjetoWithResponsavel } from "@/types";

const PROJETO_SELECT = `
  *,
  criador:profiles!projetos_criado_por_fkey(id, nome_completo, avatar_url),
  responsavel:profiles!projetos_responsavel_id_fkey(id, nome_completo, avatar_url),
  membros:projeto_membros(
    usuario_id,
    usuario:profiles!projeto_membros_usuario_id_fkey(id, nome_completo, avatar_url, cargo, papel)
  )
`;

export type ProjetoAtividadeTransferivel = {
  kind: "tarefa" | "subtarefa";
  id: string;
  titulo: string;
  concluida: boolean;
};

export type ProjetoMembroTransferInput =
  | { mode: "bulk"; novoResponsavelId: string }
  | {
      mode: "individual";
      assignments: Array<{
        kind: "tarefa" | "subtarefa";
        id: string;
        novoResponsavelId: string;
      }>;
    };

async function syncProjetoMembros(projetoId: string, usuarioIds: string[]): Promise<void> {
  const unique = [...new Set(usuarioIds.filter(Boolean))];

  const { data: atuais, error: listError } = await supabase
    .from("projeto_membros")
    .select("usuario_id")
    .eq("projeto_id", projetoId);

  if (listError) throw listError;

  const atualSet = new Set((atuais ?? []).map((row) => row.usuario_id));
  const nextSet = new Set(unique);
  const toRemove = [...atualSet].filter((id) => !nextSet.has(id));
  const toAdd = [...nextSet].filter((id) => !atualSet.has(id));

  if (toRemove.length > 0) {
    const { error: deleteError } = await supabase
      .from("projeto_membros")
      .delete()
      .eq("projeto_id", projetoId)
      .in("usuario_id", toRemove);
    if (deleteError) throw deleteError;
  }

  if (toAdd.length > 0) {
    const { error: insertError } = await supabase.from("projeto_membros").insert(
      toAdd.map((usuario_id) => ({
        projeto_id: projetoId,
        usuario_id,
      })),
    );
    if (insertError) throw insertError;
  }
}

export async function listProjetoMembros(projetoId: string): Promise<ProjetoMembro[]> {
  const { data, error } = await supabase
    .from("projeto_membros")
    .select(
      "usuario_id, usuario:profiles!projeto_membros_usuario_id_fkey(id, nome_completo, avatar_url, cargo, papel)",
    )
    .eq("projeto_id", projetoId);

  if (error) throw error;

  return (data ?? [])
    .map((row) => row.usuario)
    .filter((u): u is ProjetoMembro => !!u)
    .sort((a, b) => a.nome_completo.localeCompare(b.nome_completo, "pt-BR"));
}

export async function getProjeto(id: string): Promise<ProjetoWithResponsavel> {
  const { data, error } = await supabase
    .from("projetos")
    .select(PROJETO_SELECT)
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as ProjetoWithResponsavel;
}

export async function listProjetos(search?: string): Promise<ProjetoWithResponsavel[]> {
  let query = supabase.from("projetos").select(PROJETO_SELECT).order("nome");

  if (search?.trim()) {
    query = query.ilike("nome", `%${search.trim()}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ProjetoWithResponsavel[];
}

export async function createProjeto(payload: ProjetoFormData): Promise<ProjetoWithResponsavel> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  // Select mínimo no RETURNING: select com embeds pode falhar no RLS
  // logo após o insert e mascarar a criação com erro falso.
  const { data, error } = await supabase
    .from("projetos")
    .insert({
      nome: payload.nome.trim(),
      descricao: payload.descricao?.trim() || null,
      responsavel_id: payload.responsavel_id || null,
      data_inicio: payload.data_inicio,
      data_termino_prevista: payload.data_termino_prevista,
      status: payload.status,
      criado_por: user.id,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Já existe um projeto com este nome.");
    }
    throw error;
  }

  // Participantes: somente quem foi adicionado manualmente como membro.
  // O criador já tem visibilidade via criado_por (não precisa estar em projeto_membros).
  try {
    await syncProjetoMembros(data.id, payload.membro_ids);
  } catch (membrosError) {
    // Projeto já existe; não deixar o usuário sem feedback claro.
    throw new Error(
      `Projeto criado, mas não foi possível salvar a equipe: ${
        membrosError instanceof Error ? membrosError.message : "erro de permissão"
      }`,
    );
  }

  return getProjeto(data.id);
}

export async function updateProjeto(
  id: string,
  payload: ProjetoFormData,
): Promise<ProjetoWithResponsavel> {
  const atuais = await listProjetoMembros(id);
  const nextIds = new Set(payload.membro_ids);
  const removidos = atuais.filter((m) => !nextIds.has(m.id));

  for (const removido of removidos) {
    const atividades = await listAtividadesDoMembroNoProjeto(id, removido.id);
    if (atividades.length > 0) {
      throw new Error(
        `Não é possível remover ${removido.nome_completo} pelo formulário: há atividades sob responsabilidade. Remova a pessoa pela equipe do projeto e transfira as responsabilidades.`,
      );
    }
  }

  const { data, error } = await supabase
    .from("projetos")
    .update({
      nome: payload.nome.trim(),
      descricao: payload.descricao?.trim() || null,
      responsavel_id: payload.responsavel_id || null,
      data_inicio: payload.data_inicio,
      data_termino_prevista: payload.data_termino_prevista,
      status: payload.status,
    })
    .eq("id", id)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Já existe um projeto com este nome.");
    }
    throw error;
  }

  await syncProjetoMembros(data.id, payload.membro_ids);
  return getProjeto(id);
}

export async function addProjetoMembro(projetoId: string, usuarioId: string): Promise<void> {
  const { error } = await supabase.from("projeto_membros").upsert(
    { projeto_id: projetoId, usuario_id: usuarioId },
    { onConflict: "projeto_id,usuario_id" },
  );
  if (error) throw error;
}

export async function removeProjetoMembro(projetoId: string, usuarioId: string): Promise<void> {
  const atividades = await listAtividadesDoMembroNoProjeto(projetoId, usuarioId);
  if (atividades.length > 0) {
    throw new Error(
      "Esta pessoa possui atividades no projeto. Transfira as responsabilidades antes de remover.",
    );
  }

  const { error } = await supabase
    .from("projeto_membros")
    .delete()
    .eq("projeto_id", projetoId)
    .eq("usuario_id", usuarioId);

  if (error) throw error;
}

export async function countTarefasPorProjeto(projetoId: string): Promise<number> {
  const { count, error } = await supabase
    .from("tarefas")
    .select("id", { count: "exact", head: true })
    .eq("projeto_id", projetoId)
    .is("deleted_at", null);

  if (error) throw error;
  return count ?? 0;
}

/** Conta tarefas/subtarefas abertas (não concluídas) no projeto. */
export async function countAtividadesAbertasPorProjeto(projetoId: string): Promise<number> {
  const { count: tarefasCount, error: tarefasError } = await supabase
    .from("tarefas")
    .select("id", { count: "exact", head: true })
    .eq("projeto_id", projetoId)
    .is("deleted_at", null)
    .eq("concluida", false);

  if (tarefasError) throw tarefasError;

  const { data: tarefasDoProjeto, error: tarefasIdsError } = await supabase
    .from("tarefas")
    .select("id")
    .eq("projeto_id", projetoId)
    .is("deleted_at", null);

  if (tarefasIdsError) throw tarefasIdsError;

  const tarefaIds = (tarefasDoProjeto ?? []).map((t) => t.id);
  let subtarefasCount = 0;

  if (tarefaIds.length > 0) {
    const { count, error } = await supabase
      .from("subtarefas")
      .select("id", { count: "exact", head: true })
      .in("tarefa_id", tarefaIds)
      .eq("concluida", false);
    if (error) throw error;
    subtarefasCount += count ?? 0;
  }

  // Subtarefas com projeto_id próprio (herdado/legado), fora das tarefas já contadas acima
  const { count: subtarefasDiretas, error: subtarefasDiretasError } = await supabase
    .from("subtarefas")
    .select("id", { count: "exact", head: true })
    .eq("projeto_id", projetoId)
    .eq("concluida", false);

  if (subtarefasDiretasError) throw subtarefasDiretasError;

  // Evita dupla contagem: só as diretas cuja tarefa pai não é deste projeto
  // (aproximação: usamos o máximo simples — se projeto_id bate e tarefa_id está no set, já contou)
  if (tarefaIds.length === 0) {
    subtarefasCount += subtarefasDiretas ?? 0;
  } else if ((subtarefasDiretas ?? 0) > 0) {
    const { data: diretas, error } = await supabase
      .from("subtarefas")
      .select("id, tarefa_id")
      .eq("projeto_id", projetoId)
      .eq("concluida", false);
    if (error) throw error;
    const tarefaSet = new Set(tarefaIds);
    const extras = (diretas ?? []).filter((s) => !tarefaSet.has(s.tarefa_id)).length;
    subtarefasCount += extras;
  }

  return (tarefasCount ?? 0) + subtarefasCount;
}

/** @deprecated Use countAtividadesAbertasPorProjeto */
export async function countTarefasAbertasPorProjeto(projetoId: string): Promise<number> {
  return countAtividadesAbertasPorProjeto(projetoId);
}

export async function deleteProjeto(id: string): Promise<void> {
  // Permissão e regra de abertas ficam no RLS/trigger; aqui só executa a exclusão.
  const { error } = await supabase.from("projetos").delete().eq("id", id);
  if (error) throw error;
}

export async function listAtividadesDoMembroNoProjeto(
  projetoId: string,
  usuarioId: string,
): Promise<ProjetoAtividadeTransferivel[]> {
  const { data: tarefasDoProjeto, error: tarefasError } = await supabase
    .from("tarefas")
    .select("id, titulo, concluida")
    .eq("projeto_id", projetoId)
    .is("deleted_at", null);

  if (tarefasError) throw tarefasError;

  const tarefas = tarefasDoProjeto ?? [];
  const tarefaIds = tarefas.map((t) => t.id);
  const result: ProjetoAtividadeTransferivel[] = [];

  if (tarefaIds.length > 0) {
    const { data: links, error: linksError } = await supabase
      .from("tarefa_responsaveis")
      .select("tarefa_id")
      .eq("usuario_id", usuarioId)
      .in("tarefa_id", tarefaIds);
    if (linksError) throw linksError;

    const linked = new Set((links ?? []).map((l) => l.tarefa_id));
    for (const t of tarefas) {
      if (linked.has(t.id)) {
        result.push({ kind: "tarefa", id: t.id, titulo: t.titulo, concluida: t.concluida });
      }
    }

    const { data: subtarefas, error: subtarefasError } = await supabase
      .from("subtarefas")
      .select(
        "id, titulo, concluida, tarefa_id, responsaveis:subtarefa_responsaveis(usuario_id)",
      )
      .in("tarefa_id", tarefaIds);
    if (subtarefasError) throw subtarefasError;

    for (const s of subtarefas ?? []) {
      const isResp = (s.responsaveis ?? []).some(
        (r: { usuario_id: string }) => r.usuario_id === usuarioId,
      );
      if (isResp) {
        result.push({
          kind: "subtarefa",
          id: s.id,
          titulo: s.titulo,
          concluida: s.concluida,
        });
      }
    }
  }

  return result.sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"));
}

async function transferResponsavelTarefa(
  tarefaId: string,
  fromUserId: string,
  toUserId: string,
): Promise<void> {
  const { data: atuais, error: listError } = await supabase
    .from("tarefa_responsaveis")
    .select("usuario_id")
    .eq("tarefa_id", tarefaId);
  if (listError) throw listError;

  const next = [
    ...new Set(
      (atuais ?? [])
        .map((r) => r.usuario_id)
        .filter((id) => id !== fromUserId)
        .concat(toUserId),
    ),
  ];
  if (next.length === 0) next.push(toUserId);

  const { error: deleteError } = await supabase
    .from("tarefa_responsaveis")
    .delete()
    .eq("tarefa_id", tarefaId);
  if (deleteError) throw deleteError;

  const { error: insertError } = await supabase.from("tarefa_responsaveis").insert(
    next.map((usuario_id) => ({ tarefa_id: tarefaId, usuario_id })),
  );
  if (insertError) throw insertError;

  const { error: updateError } = await supabase
    .from("tarefas")
    .update({ atribuido_a: next[0] ?? toUserId })
    .eq("id", tarefaId);
  if (updateError) throw updateError;
}

async function transferResponsavelSubtarefa(
  subtarefaId: string,
  fromUserId: string,
  toUserId: string,
): Promise<void> {
  const { data: atuais, error: listError } = await supabase
    .from("subtarefa_responsaveis")
    .select("usuario_id")
    .eq("subtarefa_id", subtarefaId);
  if (listError) throw listError;

  const next = [
    ...new Set(
      (atuais ?? [])
        .map((r) => r.usuario_id)
        .filter((id) => id !== fromUserId)
        .concat(toUserId),
    ),
  ];

  const { error: deleteError } = await supabase
    .from("subtarefa_responsaveis")
    .delete()
    .eq("subtarefa_id", subtarefaId);
  if (deleteError) throw deleteError;

  if (next.length > 0) {
    const { error: insertError } = await supabase.from("subtarefa_responsaveis").insert(
      next.map((usuario_id) => ({ subtarefa_id: subtarefaId, usuario_id })),
    );
    if (insertError) throw insertError;
  }
}

async function assertNovoResponsavelEhMembroDoProjeto(
  projetoId: string,
  usuarioRemovidoId: string,
  novoResponsavelId: string,
): Promise<void> {
  if (!novoResponsavelId || novoResponsavelId === usuarioRemovidoId) {
    throw new Error("Selecione um novo responsável válido.");
  }

  const { data, error } = await supabase
    .from("projeto_membros")
    .select("usuario_id")
    .eq("projeto_id", projetoId)
    .eq("usuario_id", novoResponsavelId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error(
      "O novo responsável precisa ser um membro atual do projeto.",
    );
  }
}

export async function removeProjetoMembroComTransferencia(
  projetoId: string,
  usuarioId: string,
  transfer: ProjetoMembroTransferInput,
): Promise<void> {
  const atividades = await listAtividadesDoMembroNoProjeto(projetoId, usuarioId);

  if (atividades.length > 0) {
    if (transfer.mode === "bulk") {
      await assertNovoResponsavelEhMembroDoProjeto(
        projetoId,
        usuarioId,
        transfer.novoResponsavelId,
      );
      for (const atividade of atividades) {
        if (atividade.kind === "tarefa") {
          await transferResponsavelTarefa(
            atividade.id,
            usuarioId,
            transfer.novoResponsavelId,
          );
        } else {
          await transferResponsavelSubtarefa(
            atividade.id,
            usuarioId,
            transfer.novoResponsavelId,
          );
        }
      }
    } else {
      const map = new Map(
        transfer.assignments.map((a) => [`${a.kind}:${a.id}`, a.novoResponsavelId] as const),
      );
      const novosUnicos = new Set<string>();
      for (const atividade of atividades) {
        const novo = map.get(`${atividade.kind}:${atividade.id}`);
        if (!novo || novo === usuarioId) {
          throw new Error(
            `Defina um novo responsável para "${atividade.titulo}" antes de remover.`,
          );
        }
        novosUnicos.add(novo);
      }
      for (const novo of novosUnicos) {
        await assertNovoResponsavelEhMembroDoProjeto(projetoId, usuarioId, novo);
      }
      for (const atividade of atividades) {
        const novo = map.get(`${atividade.kind}:${atividade.id}`)!;
        if (atividade.kind === "tarefa") {
          await transferResponsavelTarefa(atividade.id, usuarioId, novo);
        } else {
          await transferResponsavelSubtarefa(atividade.id, usuarioId, novo);
        }
      }
    }
  }

  const { error } = await supabase
    .from("projeto_membros")
    .delete()
    .eq("projeto_id", projetoId)
    .eq("usuario_id", usuarioId);

  if (error) throw error;
}
