import type { Tables } from "./database";

export type Papel = Tables<"profiles">["papel"];
export type TarefaStatus = Tables<"tarefas">["status"];
export type TarefaPrioridade = Tables<"tarefas">["prioridade"];
export type TarefaVisibilidade = Tables<"tarefas">["visibilidade"];
export type TarefaLembreteOpcao = "no_prazo" | "1h_antes" | "1d_antes" | "1sem_antes";

export type Profile = Tables<"profiles">;
export type Setor = Tables<"setores">;
export type Tarefa = Tables<"tarefas">;

export type ProfileWithSetor = Profile & {
  setor: Pick<Setor, "id" | "nome" | "cor"> | null;
  gestor: Pick<Profile, "id" | "nome_completo" | "papel"> | null;
};

export type SetorWithGerente = Setor & {
  gerente: Pick<Profile, "id" | "nome_completo" | "avatar_url"> | null;
};

export type SetorFormData = {
  nome: string;
  cor: string;
  descricao?: string;
  gerente_id?: string | null;
};

export type Projeto = Tables<"projetos">;
export type ProjetoStatus = Projeto["status"];

export type ProjetoWithResponsavel = Projeto & {
  responsavel: Pick<Profile, "id" | "nome_completo" | "avatar_url"> | null;
  membros?: {
    usuario_id: string;
    usuario: Pick<Profile, "id" | "nome_completo" | "avatar_url" | "cargo" | "papel"> | null;
  }[];
};

export type ProjetoFormData = {
  nome: string;
  descricao?: string;
  responsavel_id: string | null;
  membro_ids: string[];
  data_inicio: string | null;
  data_termino_prevista: string | null;
  status: ProjetoStatus;
};

export type ProjetoMembro = Pick<Profile, "id" | "nome_completo" | "avatar_url" | "cargo" | "papel">;

export type EquipeGrupo = Tables<"equipe_grupos">;
export type EquipeGrupoMembro = Tables<"equipe_grupo_membros">;

export type EquipeGrupoWithMembros = EquipeGrupo & {
  membros: EquipeGrupoMembro[];
};

export type ProfileFormData = {
  nome_completo: string;
  email?: string;
  password?: string;
  cargo?: string;
  setor_id: string | null;
  papel: Papel;
  gestor_id: string | null;
  ativo: boolean;
  avatar_file?: File | null;
};

export type DashboardKpis = {
  totalTarefas: number;
  tarefasAFazer: number;
  tarefasEmAndamento: number;
  tarefasConcluidas: number;
  tarefasBloqueadas: number;
  tarefasVencendoHoje: number;
  totalSetores: number;
  totalPessoas: number;
};

export type TarefaWithRelations = Tarefa & {
  setor: Pick<Setor, "id" | "nome" | "cor"> | null;
  projeto: Pick<Projeto, "id" | "nome"> | null;
  criador: Pick<Profile, "id" | "nome_completo" | "avatar_url"> | null;
  /** @deprecated Preferir `responsaveis` — mantido para compatibilidade com embed legado */
  responsavel: Pick<Profile, "id" | "nome_completo" | "avatar_url"> | null;
  responsaveis?: {
    usuario_id: string;
    usuario: Pick<Profile, "id" | "nome_completo" | "avatar_url"> | null;
  }[];
  observadores?: {
    usuario_id: string;
    usuario: Pick<Profile, "id" | "nome_completo" | "avatar_url"> | null;
  }[];
};

export type RecorrenciaTipo = "nenhuma" | "diaria" | "semanal" | "mensal";

export type RecorrenciaConfig = {
  tipo: RecorrenciaTipo;
  dias_semana?: number[];
  dia_mes?: number;
  data_fim?: string | null;
};

export type TarefaFormData = {
  titulo: string;
  descricao: string;
  projeto_id: string | null;
  setor_id: string | null;
  /** @deprecated Use `atribuido_ids` */
  atribuido_a: string | null;
  atribuido_ids: string[];
  prioridade: TarefaPrioridade;
  status: TarefaStatus;
  data_inicio: string | null;
  data_vencimento: string | null;
  tags: string[];
  recorrencia: RecorrenciaConfig | null;
  visibilidade: TarefaVisibilidade;
  observador_ids: string[];
  lembretes: TarefaLembreteOpcao[];
};

export type TarefaAnexo = Tables<"tarefa_anexos">;

export type TarefaFilters = {
  search?: string;
  status?: TarefaStatus | "all";
  prioridade?: TarefaPrioridade | "all";
  setor_id?: string | "all";
  projeto_id?: string | "all";
  /** @deprecated Preferir `atribuido_ids` */
  atribuido_a?: string | "all";
  /** Filtro multi: tarefa aparece se qualquer um destes for responsável */
  atribuido_ids?: string[];
  tag?: string;
};

export type Subtarefa = Tables<"subtarefas">;

export type TarefaComentario = Tables<"tarefa_comentarios"> & {
  usuario: Pick<Profile, "id" | "nome_completo" | "avatar_url"> | null;
};

export type TarefaDetail = TarefaWithRelations & {
  subtarefas: Subtarefa[];
  comentarios: TarefaComentario[];
  anexos: TarefaAnexo[];
};

export type Aviso = Tables<"avisos">;
export type AvisoAlcance = Aviso["alcance"];
export type AvisoPrioridade = Aviso["prioridade"];

export type AvisoWithRelations = Aviso & {
  criador: Pick<Profile, "id" | "nome_completo" | "avatar_url"> | null;
  setores: { setor: Pick<Setor, "id" | "nome"> | null }[];
  pessoas: { usuario: Pick<Profile, "id" | "nome_completo" | "avatar_url"> | null }[];
  lido_por: { usuario_id: string }[];
};

export type AvisoComentario = Tables<"aviso_comentarios"> & {
  usuario: Pick<Profile, "id" | "nome_completo" | "avatar_url"> | null;
};

export type AvisoDetail = AvisoWithRelations & {
  comentarios: AvisoComentario[];
};

export type AvisoFormData = {
  titulo: string;
  conteudo: string;
  alcance: AvisoAlcance;
  prioridade: AvisoPrioridade;
  data_expiracao: string;
  fixado: boolean;
  comentarios_permitidos: boolean;
  setor_ids: string[];
  usuario_ids: string[];
};

export type AvisoLeituraFiltro = "todos" | "lidos" | "nao_lidos";
export type AvisoAba = "ativos" | "finalizados";

export type Notificacao = Tables<"notificacoes">;

export type RelatoriosData = {
  totalTarefas: number;
  porStatus: { status: TarefaStatus; total: number }[];
  porPrioridade: { prioridade: TarefaPrioridade; total: number }[];
  porSetor: { setor_id: string; nome: string; cor: string | null; total: number }[];
  porPessoa: { usuario_id: string; nome: string; total: number }[];
  conclusoesPorDia: { data: string; total: number }[];
};

export type AdminCreateUserData = {
  email: string;
  password: string;
  nome_completo: string;
  papel: Papel;
  setor_id: string | null;
  gestor_id?: string | null;
};
