export const profileKeys = {
  all: ["profiles"] as const,
  me: () => [...profileKeys.all, "me"] as const,
  list: (search?: string) => [...profileKeys.all, "list", search ?? ""] as const,
};

export const setorKeys = {
  all: ["setores"] as const,
  list: () => [...setorKeys.all, "list"] as const,
  detail: (id: string) => [...setorKeys.all, id] as const,
};

export const projetoKeys = {
  all: ["projetos"] as const,
  list: (search?: string) => [...projetoKeys.all, "list", search ?? ""] as const,
  detail: (id: string) => [...projetoKeys.all, "detail", id] as const,
};

export const equipeGrupoKeys = {
  all: ["equipe-grupos"] as const,
  list: () => [...equipeGrupoKeys.all, "list"] as const,
};

export const empresaKeys = {
  all: ["empresa"] as const,
  config: () => [...empresaKeys.all, "config"] as const,
};

export const tarefaKeys = {
  all: ["tarefas"] as const,
  list: (filters?: Record<string, string>) => [...tarefaKeys.all, "list", filters ?? {}] as const,
  detail: (id: string) => [...tarefaKeys.all, "detail", id] as const,
  kpis: () => [...tarefaKeys.all, "kpis"] as const,
  recent: () => [...tarefaKeys.all, "recent"] as const,
  calendario: (mes: string) => [...tarefaKeys.all, "calendario", mes] as const,
};

export const anexoKeys = {
  all: ["anexos"] as const,
  list: (tarefaId: string) => [...anexoKeys.all, tarefaId] as const,
  subtarefa: (subtarefaId: string) => [...anexoKeys.all, "subtarefa", subtarefaId] as const,
};

export const subtarefaKeys = {
  all: ["subtarefas"] as const,
  detail: (id: string) => [...subtarefaKeys.all, "detail", id] as const,
  agenda: (filters?: Record<string, string>) =>
    [...subtarefaKeys.all, "agenda", filters ?? {}] as const,
};

export const avisoKeys = {
  all: ["avisos"] as const,
  list: () => [...avisoKeys.all, "list"] as const,
  detail: (id: string) => [...avisoKeys.all, "detail", id] as const,
};

export const notificacaoKeys = {
  all: ["notificacoes"] as const,
  list: () => [...notificacaoKeys.all, "list"] as const,
  unread: () => [...notificacaoKeys.all, "unread"] as const,
};

export const relatorioKeys = {
  all: ["relatorios"] as const,
  data: () => [...relatorioKeys.all, "data"] as const,
};
