import { supabase } from "@/integrations/supabase/client";
import type { RelatoriosData, TarefaPrioridade } from "@/types";
import { format, subDays, startOfDay } from "date-fns";

export async function getRelatoriosData(): Promise<RelatoriosData> {
  const [tarefasRes, setoresRes, profilesRes, responsaveisRes] = await Promise.all([
    supabase
      .from("tarefas")
      .select("id, concluida, prioridade, setor_id, data_conclusao, created_at, atribuido_a")
      .is("deleted_at", null),
    supabase.from("setores").select("id, nome, cor"),
    supabase.from("profiles").select("id, nome_completo, setor_id, ativo").eq("ativo", true),
    supabase.from("tarefa_responsaveis").select("tarefa_id, usuario_id"),
  ]);

  if (tarefasRes.error) throw tarefasRes.error;
  if (setoresRes.error) throw setoresRes.error;
  if (profilesRes.error) throw profilesRes.error;
  if (responsaveisRes.error) throw responsaveisRes.error;

  const tarefas = tarefasRes.data ?? [];
  const setores = setoresRes.data ?? [];
  const profiles = profilesRes.data ?? [];
  const responsaveis = responsaveisRes.data ?? [];

  const responsaveisPorTarefa = new Map<string, string[]>();
  for (const row of responsaveis) {
    const current = responsaveisPorTarefa.get(row.tarefa_id) ?? [];
    current.push(row.usuario_id);
    responsaveisPorTarefa.set(row.tarefa_id, current);
  }

  const porConclusao = [false, true].map((concluida) => ({
    concluida,
    total: tarefas.filter((t) => t.concluida === concluida).length,
  }));

  const porPrioridade = (["P1", "P2", "P3", "P4"] as TarefaPrioridade[]).map((prioridade) => ({
    prioridade,
    total: tarefas.filter((t) => t.prioridade === prioridade).length,
  }));

  const porSetor = setores.map((setor) => ({
    setor_id: setor.id,
    nome: setor.nome,
    cor: setor.cor,
    total: tarefas.filter((t) => t.setor_id === setor.id).length,
  }));

  const semSetor = tarefas.filter((t) => !t.setor_id).length;
  if (semSetor > 0) {
    porSetor.push({ setor_id: "sem-setor", nome: "Sem setor", cor: null, total: semSetor });
  }

  const porPessoa = profiles
    .map((p) => ({
      usuario_id: p.id,
      nome: p.nome_completo,
      total: tarefas.filter((t) => {
        const ids = responsaveisPorTarefa.get(t.id);
        if (ids?.includes(p.id)) return true;
        return t.atribuido_a === p.id;
      }).length,
    }))
    .filter((p) => p.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const ultimos7Dias = Array.from({ length: 7 }, (_, i) => {
    const dia = startOfDay(subDays(new Date(), 6 - i));
    const diaFim = new Date(dia);
    diaFim.setHours(23, 59, 59, 999);
    const label = format(dia, "dd/MM");
    const total = tarefas.filter((t) => {
      if (!t.data_conclusao) return false;
      const d = new Date(t.data_conclusao);
      return d >= dia && d <= diaFim;
    }).length;
    return { data: label, total };
  });

  return {
    totalTarefas: tarefas.length,
    porConclusao,
    porPrioridade,
    porSetor,
    porPessoa,
    conclusoesPorDia: ultimos7Dias,
  };
}
