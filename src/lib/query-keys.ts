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
