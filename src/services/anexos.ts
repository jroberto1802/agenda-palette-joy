import { supabase } from "@/integrations/supabase/client";
import {
  getCurrentActor,
  getTarefaStakeholderIds,
  notifyTarefaAnexo,
} from "@/services/notificacao-events";
import type { SubtarefaAnexo, TarefaAnexo } from "@/types";

const BUCKET = "tarefa-anexos";

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
  const storagePath = `${tarefaId}/${crypto.randomUUID()}_${file.name}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    cacheControl: "3600",
    upsert: false,
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
    usuarioIds: stakeholders,
    tarefaId,
    titulo: tarefa?.titulo ?? "tarefa",
    atorNome: ator?.nome ?? "Alguém",
  }).catch(() => undefined);

  return data;
}

export async function deleteAnexo(anexo: TarefaAnexo): Promise<void> {
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([anexo.storage_path]);
  if (storageError) throw storageError;

  const { error } = await supabase.from("tarefa_anexos").delete().eq("id", anexo.id);
  if (error) throw error;
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
    .select("tarefa_id")
    .eq("id", subtarefaId)
    .single();
  if (subtarefaError) throw subtarefaError;

  // Pasta raiz = tarefa_id para reutilizar as policies do bucket tarefa-anexos
  const storagePath = `${subtarefa.tarefa_id}/sub/${subtarefaId}/${crypto.randomUUID()}_${file.name}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    cacheControl: "3600",
    upsert: false,
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

  return data;
}

export async function deleteSubtarefaAnexo(anexo: SubtarefaAnexo): Promise<void> {
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([anexo.storage_path]);
  if (storageError) throw storageError;

  const { error } = await supabase.from("subtarefa_anexos").delete().eq("id", anexo.id);
  if (error) throw error;
}

export async function getAnexoSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 3600);
  if (error) throw error;
  return data.signedUrl;
}
