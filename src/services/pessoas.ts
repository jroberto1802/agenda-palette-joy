import { supabase } from "@/integrations/supabase/client";
import { criarUsuarioAdmin, excluirUsuarioAdmin } from "@/services/admin";
import {
  transferResponsavelSubtarefa,
  transferResponsavelTarefa,
  type ProjetoAtividadeTransferivel,
  type ProjetoMembroTransferInput,
} from "@/services/projetos";
import { removeProfileAvatar, uploadProfileAvatar } from "@/services/profile-avatars";
import type { ProfileFormData, ProfileWithSetor } from "@/types";

const PESSOA_SELECT_BASIC = `*, setor:setores!profiles_setor_id_fkey(id, nome, cor)`;

export type PessoaAtividadeTransferivel = ProjetoAtividadeTransferivel & {
  contexto?: string | null;
};

export type PessoaDesativarTransferInput = ProjetoMembroTransferInput;

type ProfileRow = Omit<ProfileWithSetor, "gestor">;

async function attachGestores(pessoas: ProfileRow[]): Promise<ProfileWithSetor[]> {
  const gestorIds = [...new Set(pessoas.map((p) => p.gestor_id).filter((id): id is string => !!id))];

  if (!gestorIds.length) {
    return pessoas.map((pessoa) => ({ ...pessoa, gestor: null }));
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, nome_completo, papel")
    .in("id", gestorIds);
  if (error) throw error;

  const gestores = new Map((data ?? []).map((gestor) => [gestor.id, gestor]));
  return pessoas.map((pessoa) => ({
    ...pessoa,
    gestor: pessoa.gestor_id ? (gestores.get(pessoa.gestor_id) ?? null) : null,
  }));
}

export async function getMyProfile(): Promise<ProfileWithSetor> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  // Sem embed de gestor: self-join + RLS pode falhar e esconder a aba Cadastros.
  const { data, error } = await supabase
    .from("profiles")
    .select(PESSOA_SELECT_BASIC)
    .eq("id", user.id)
    .single();

  if (error) throw error;

  const [profile] = await attachGestores([(data as unknown) as ProfileRow]);
  return profile;
}

export async function listPessoas(search?: string): Promise<ProfileWithSetor[]> {
  let query = supabase.from("profiles").select(PESSOA_SELECT_BASIC).order("nome_completo");

  if (search?.trim()) {
    const term = search.trim();
    query = query.or(
      `nome_completo.ilike.%${term}%,cargo.ilike.%${term}%,email.ilike.%${term}%`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return attachGestores(((data ?? []) as unknown) as ProfileRow[]);
}
export async function countActiveAdmins(excludeId?: string): Promise<number> {
  let query = supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("papel", "admin")
    .eq("ativo", true);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function createPessoa(payload: ProfileFormData): Promise<{ user_id: string }> {
  if (!payload.email?.trim()) {
    throw new Error("E-mail é obrigatório.");
  }
  if (!payload.password?.trim()) {
    throw new Error("Senha provisória é obrigatória.");
  }
  if (!payload.papel) {
    throw new Error("Papel é obrigatório.");
  }

  const created = await criarUsuarioAdmin({
    email: payload.email.trim(),
    password: payload.password,
    nome_completo: payload.nome_completo.trim(),
    papel: payload.papel,
    setor_id: payload.setor_id,
    gestor_id: payload.gestor_id,
  });

  if (payload.avatar_file) {
    const avatarUrl = await uploadProfileAvatar(created.user_id, payload.avatar_file);
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", created.user_id);
    if (error) throw error;
  }

  return created;
}

export async function updatePessoa(id: string, payload: ProfileFormData): Promise<ProfileWithSetor> {
  const current = await supabase
    .from("profiles")
    .select("papel, ativo, avatar_url")
    .eq("id", id)
    .single();

  if (current.error) throw current.error;

  if (payload.papel !== "admin" || payload.ativo === false) {
    const wasActiveAdmin = current.data.papel === "admin" && current.data.ativo;
    const willLoseAdmin =
      wasActiveAdmin && (payload.papel !== "admin" || payload.ativo === false);

    if (willLoseAdmin) {
      const remaining = await countActiveAdmins(id);
      if (remaining === 0) {
        throw new Error(
          "Não é possível inativar ou rebaixar o último Administrador do sistema.",
        );
      }
    }
  }

  let avatarUrl = current.data.avatar_url;
  if (payload.avatar_file) {
    avatarUrl = await uploadProfileAvatar(id, payload.avatar_file, current.data.avatar_url);
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      nome_completo: payload.nome_completo,
      cargo: payload.cargo || null,
      setor_id: payload.setor_id,
      papel: payload.papel,
      ativo: payload.ativo,
      gestor_id: payload.gestor_id,
      avatar_url: avatarUrl,
    })
    .eq("id", id)
    .select(PESSOA_SELECT_BASIC)
    .single();

  if (error) throw error;
  const [profile] = await attachGestores([((data as unknown) as ProfileRow)]);
  return profile;
}

export async function deletePessoa(id: string): Promise<void> {
  const { data: pessoa, error: fetchError } = await supabase
    .from("profiles")
    .select("papel, ativo, avatar_url")
    .eq("id", id)
    .single();

  if (fetchError) throw fetchError;

  if (pessoa.papel === "admin" && pessoa.ativo) {
    const remaining = await countActiveAdmins(id);
    if (remaining === 0) {
      throw new Error("Não é possível excluir o último Administrador do sistema.");
    }
  }

  await removeProfileAvatar(pessoa.avatar_url).catch(() => undefined);
  await excluirUsuarioAdmin(id);
}

/** Lista tarefas e subtarefas em que a pessoa é responsável (qualquer projeto ou avulsa). */
export async function listAtividadesDoResponsavel(
  usuarioId: string,
): Promise<PessoaAtividadeTransferivel[]> {
  const result: PessoaAtividadeTransferivel[] = [];

  const { data: tarefaLinks, error: tarefaLinksError } = await supabase
    .from("tarefa_responsaveis")
    .select(
      `
      tarefa_id,
      tarefa:tarefas!inner(
        id,
        titulo,
        concluida,
        deleted_at,
        projeto:projetos(nome)
      )
    `,
    )
    .eq("usuario_id", usuarioId);

  if (tarefaLinksError) throw tarefaLinksError;

  for (const link of tarefaLinks ?? []) {
    const tarefa = link.tarefa as unknown as {
      id: string;
      titulo: string;
      concluida: boolean;
      deleted_at: string | null;
      projeto: { nome: string } | null;
    } | null;
    if (!tarefa || tarefa.deleted_at) continue;
    result.push({
      kind: "tarefa",
      id: tarefa.id,
      titulo: tarefa.titulo,
      concluida: tarefa.concluida,
      contexto: tarefa.projeto?.nome ?? null,
    });
  }

  const { data: subtarefaLinks, error: subtarefaLinksError } = await supabase
    .from("subtarefa_responsaveis")
    .select(
      `
      subtarefa_id,
      subtarefa:subtarefas!inner(
        id,
        titulo,
        concluida,
        tarefa:tarefas!inner(
          deleted_at,
          projeto:projetos(nome)
        )
      )
    `,
    )
    .eq("usuario_id", usuarioId);

  if (subtarefaLinksError) throw subtarefaLinksError;

  for (const link of subtarefaLinks ?? []) {
    const subtarefa = link.subtarefa as unknown as {
      id: string;
      titulo: string;
      concluida: boolean;
      tarefa: {
        deleted_at: string | null;
        projeto: { nome: string } | null;
      } | null;
    } | null;
    if (!subtarefa || subtarefa.tarefa?.deleted_at) continue;
    result.push({
      kind: "subtarefa",
      id: subtarefa.id,
      titulo: subtarefa.titulo,
      concluida: subtarefa.concluida,
      contexto: subtarefa.tarefa?.projeto?.nome ?? null,
    });
  }

  return result.sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"));
}

async function applyTransferenciaResponsabilidades(
  usuarioId: string,
  atividades: PessoaAtividadeTransferivel[],
  transfer: PessoaDesativarTransferInput,
): Promise<void> {
  if (atividades.length === 0) return;

  if (transfer.mode === "bulk") {
    const novo = transfer.novoResponsavelId;
    if (!novo || novo === usuarioId) {
      throw new Error("Selecione um novo responsável válido.");
    }
    for (const atividade of atividades) {
      if (atividade.kind === "tarefa") {
        await transferResponsavelTarefa(atividade.id, usuarioId, novo);
      } else {
        await transferResponsavelSubtarefa(atividade.id, usuarioId, novo);
      }
    }
    return;
  }

  const map = new Map(
    transfer.assignments.map((a) => [`${a.kind}:${a.id}`, a.novoResponsavelId] as const),
  );
  for (const atividade of atividades) {
    const novo = map.get(`${atividade.kind}:${atividade.id}`);
    if (!novo || novo === usuarioId) {
      throw new Error(
        `Defina um novo responsável para "${atividade.titulo}" antes de desativar.`,
      );
    }
    if (atividade.kind === "tarefa") {
      await transferResponsavelTarefa(atividade.id, usuarioId, novo);
    } else {
      await transferResponsavelSubtarefa(atividade.id, usuarioId, novo);
    }
  }
}

/**
 * Desativa a pessoa (revoga acesso). Se houver atividades sob responsabilidade,
 * exige transferência (bulk ou individual) antes de concluir.
 */
export async function desativarPessoa(
  id: string,
  transfer?: PessoaDesativarTransferInput,
): Promise<ProfileWithSetor> {
  const { data: pessoa, error: fetchError } = await supabase
    .from("profiles")
    .select("papel, ativo, nome_completo, setor_id, gestor_id")
    .eq("id", id)
    .single();

  if (fetchError) throw fetchError;
  if (!pessoa.ativo) {
    throw new Error("Esta pessoa já está desativada.");
  }

  if (pessoa.papel === "admin") {
    const remaining = await countActiveAdmins(id);
    if (remaining === 0) {
      throw new Error("Não é possível desativar o último Administrador do sistema.");
    }
  }

  const atividades = await listAtividadesDoResponsavel(id);
  if (atividades.length > 0) {
    if (!transfer) {
      throw new Error(
        "Esta pessoa possui atividades sob responsabilidade. Defina o novo responsável antes de desativar.",
      );
    }
    await applyTransferenciaResponsabilidades(id, atividades, transfer);
  }

  return updatePessoa(id, {
    nome_completo: pessoa.nome_completo,
    setor_id: pessoa.setor_id,
    papel: pessoa.papel,
    gestor_id: pessoa.gestor_id,
    ativo: false,
  });
}

export async function reativarPessoa(id: string): Promise<ProfileWithSetor> {
  const { data: pessoa, error: fetchError } = await supabase
    .from("profiles")
    .select("papel, ativo, nome_completo, setor_id, gestor_id")
    .eq("id", id)
    .single();

  if (fetchError) throw fetchError;
  if (pessoa.ativo) {
    throw new Error("Esta pessoa já está ativa.");
  }

  return updatePessoa(id, {
    nome_completo: pessoa.nome_completo,
    setor_id: pessoa.setor_id,
    papel: pessoa.papel,
    gestor_id: pessoa.gestor_id,
    ativo: true,
  });
}

export async function updateMyProfile(payload: {
  nome_completo: string;
  avatar_url?: string | null;
  cargo?: string | null;
}): Promise<ProfileWithSetor> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  const { data, error } = await supabase
    .from("profiles")
    .update({
      nome_completo: payload.nome_completo,
      avatar_url: payload.avatar_url ?? null,
      cargo: payload.cargo || null,
    })
    .eq("id", user.id)
    .select(PESSOA_SELECT_BASIC)
    .single();

  if (error) throw error;
  const [profile] = await attachGestores([((data as unknown) as ProfileRow)]);
  return profile;
}
