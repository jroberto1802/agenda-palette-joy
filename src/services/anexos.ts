import { supabase } from "@/integrations/supabase/client";
import {
  getCurrentActor,
  getSubtarefaResponsavelIds,
  getTarefaStakeholderIds,
  notifySubtarefaAnexo,
  notifyTarefaAnexo,
} from "@/services/notificacao-events";
import type { SubtarefaAnexo, TarefaAnexo } from "@/types";

const BUCKET = "tarefa-anexos";

/** Gera nome seguro para a key do Storage; o nome original fica só no campo `nome`. */
function normalizeStorageFileName(fileName: string): string {
  const base = fileName.trim() || "arquivo";
  const sanitized = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._]+|[._]+$/g, "");
  return sanitized || "arquivo";
}

function buildStoragePath(prefix: string, fileName: string): string {
  return `${prefix}/${crypto.randomUUID()}_${normalizeStorageFileName(fileName)}`;
}

export async function listAnexos(tarefaId: string): Promise<TarefaAnexo[]> {
  const { data, error } = await supabase
    .from("tarefa_anexos")
    .select("*")
    .eq("tarefa_id", tarefaId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function uploadAnexo(tarefaId: string, file: File): Promise<TarefaAnexo> {
  const storagePath = buildStoragePath(tarefaId, file.name);

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("tarefa_anexos")
    .insert({
      tarefa_id: tarefaId,
      storage_path: storagePath,
      nome: file.name,
      tipo: file.type || null,
      tamanho: file.size,
    })
    .select()
    .single();

  if (error) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw error;
  }

  const [{ data: tarefa }, ator, stakeholders] = await Promise.all([
    supabase.from("tarefas").select("titulo").eq("id", tarefaId).single(),
    getCurrentActor(),
    getTarefaStakeholderIds(tarefaId),
  ]);

  await notifyTarefaAnexo({
    usuarioIds: stakeholders.filter((id) => id !== ator?.id),
    tarefaId,
    titulo: tarefa?.titulo ?? "tarefa",
    atorNome: ator?.nome ?? "Alguém",
  }).catch(() => undefined);

  return data;
}

export async function deleteAnexo(anexo: TarefaAnexo): Promise<void> {
  const { error } = await supabase.from("tarefa_anexos").delete().eq("id", anexo.id);
  if (error) throw error;

  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([anexo.storage_path]);
  if (storageError) {
    console.warn("Falha ao remover arquivo do storage da tarefa:", storageError.message);
  }
}

export async function listSubtarefaAnexos(subtarefaId: string): Promise<SubtarefaAnexo[]> {
  const { data, error } = await supabase
    .from("subtarefa_anexos")
    .select("*")
    .eq("subtarefa_id", subtarefaId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function uploadSubtarefaAnexo(
  subtarefaId: string,
  file: File,
): Promise<SubtarefaAnexo> {
  const { data: subtarefa, error: subtarefaError } = await supabase
    .from("subtarefas")
    .select("tarefa_id, titulo")
    .eq("id", subtarefaId)
    .single();
  if (subtarefaError) throw subtarefaError;

  // Pasta raiz = tarefa_id para reutilizar as policies do bucket tarefa-anexos
  const storagePath = buildStoragePath(
    `${subtarefa.tarefa_id}/sub/${subtarefaId}`,
    file.name,
  );

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("subtarefa_anexos")
    .insert({
      subtarefa_id: subtarefaId,
      storage_path: storagePath,
      nome: file.name,
      tipo: file.type || null,
      tamanho: file.size,
    })
    .select()
    .single();

  if (error) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw error;
  }

  const [{ data: tarefa }, ator, responsaveis] = await Promise.all([
    supabase.from("tarefas").select("titulo").eq("id", subtarefa.tarefa_id).single(),
    getCurrentActor(),
    getSubtarefaResponsavelIds(subtarefaId),
  ]);

  await notifySubtarefaAnexo({
    usuarioIds: responsaveis.filter((id) => id !== ator?.id),
    tarefaId: subtarefa.tarefa_id,
    subtarefaId,
    tarefaTitulo: tarefa?.titulo ?? "tarefa",
    subtarefaTitulo: subtarefa.titulo ?? "subtarefa",
    atorNome: ator?.nome ?? "Alguém",
  }).catch(() => undefined);

  return data;
}

export async function deleteSubtarefaAnexo(anexo: SubtarefaAnexo): Promise<void> {
  // Remove o registro primeiro para a UI atualizar mesmo se o Storage falhar.
  const { error } = await supabase.from("subtarefa_anexos").delete().eq("id", anexo.id);
  if (error) throw error;

  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([anexo.storage_path]);
  if (storageError) {
    console.warn("Falha ao remover arquivo do storage da subtarefa:", storageError.message);
  }
}

export async function getAnexoSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600, { download: true });
  if (error) throw error;
  return data.signedUrl;
}

/**
 * Baixa o arquivo via storage autenticado (blob), evitando bloqueio de popup
 * que ocorre com `window.open` após `await` — especialmente em Sheet dentro de Dialog.
 */
export async function downloadAnexoFile(
  storagePath: string,
  fileName: string,
): Promise<void> {
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
  if (error) throw error;

  const objectUrl = URL.createObjectURL(data);
  try {
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName.trim() || "anexo";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
