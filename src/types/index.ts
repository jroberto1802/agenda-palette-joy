import type { Tables } from "./database";

export type Papel = Tables<"profiles">["papel"];
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
  criador: Pick<Profile, "id" | "nome_completo" | "avatar_url"> | null;
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

export type EmpresaConfig = Tables<"empresa_config">;

export type EmpresaConfigFormData = {
  nome: string;
  logo_file?: File | null;
  remove_logo?: boolean;
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
  tarefasAbertas: number;
  tarefasConcluidas: number;
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

export type RecorrenciaTipo =
  | "nenhuma"
  | "diaria"
  | "semanal"
  | "mensal"
  | "anual"
  | "personalizada";

export type RecorrenciaUnidade = "dias" | "semanas" | "meses";

export type RecorrenciaConfig = {
  tipo: RecorrenciaTipo;
  /** Semanal: 0=Dom … 6=Sáb */
  dias_semana?: number[];
  /** Mensal: dia do mês (1–28) */
  dia_mes?: number;
  /**
   * Personalizada: a cada X dias/semanas/meses.
   * Anual: a cada X anos (padrão 1).
   */
  intervalo?: number;
  unidade?: RecorrenciaUnidade;
  /** Personalizada: datas livres YYYY-MM-DD */
  datas_livres?: string[];
  /** Âncora estável da série (YYYY-MM-DD) — não muda ao avançar a próxima prevista. */
  data_ancora?: string | null;
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
  data_inicio: string | null;
  tags: string[];
  recorrencia: RecorrenciaConfig | null;
  visibilidade: TarefaVisibilidade;
  observador_ids: string[];
  lembretes: TarefaLembreteOpcao[];
};

export type TarefaAnexo = Tables<"tarefa_anexos">;

export type TarefaFilters = {
  search?: string;
  prioridade?: TarefaPrioridade | "all";
  setor_id?: string | "all";
  projeto_id?: string | "all";
  /** @deprecated Preferir `atribuido_ids` */
  atribuido_a?: string | "all";
  /** Filtro multi: tarefa aparece se qualquer um destes for responsável */
  atribuido_ids?: string[];
  tag?: string;
  /** Classificação da listagem: Por Prioridade ou Por Data (crescente). */
  classificar?: "prioridade" | "data_asc";
  /** Menu Finalizados: restringe a itens concluídos (`concluida = true`). */
  somente_finalizadas?: boolean;
  /** Agenda/Projeto/Calendário: omite concluídas (vão para Finalizados). */
  excluir_finalizadas?: boolean;
  /** YYYY-MM-DD — início do intervalo por data_conclusao */
  periodo_inicio?: string;
  /** YYYY-MM-DD — fim do intervalo por data_conclusao */
  periodo_fim?: string;
  /** YYYY-MM-DD — início do intervalo por campo Data (`data_inicio`) */
  data_inicio_de?: string;
  /** YYYY-MM-DD — fim do intervalo por campo Data (`data_inicio`) */
  data_inicio_ate?: string;
  /** Agenda Hoje: `data_inicio` anterior a hoje (itens abertos com data vencida). */
  somente_atrasadas?: boolean;
  /**
   * Agenda Visualizando: itens visíveis por visibilidade,
   * excluindo aqueles em que o usuário logado é responsável ou criador.
   */
  somente_visualizando?: boolean;
};

export type Subtarefa = Tables<"subtarefas">;
export type SubtarefaAnexo = Tables<"subtarefa_anexos">;

export type SubtarefaWithAuthors = Subtarefa & {
  criador: Pick<Profile, "id" | "nome_completo" | "avatar_url"> | null;
  concluido_por_usuario: Pick<Profile, "id" | "nome_completo" | "avatar_url"> | null;
  responsaveis?: {
    usuario_id: string;
    usuario: Pick<Profile, "id" | "nome_completo" | "avatar_url"> | null;
  }[];
  observadores?: {
    usuario_id: string;
    usuario: Pick<Profile, "id" | "nome_completo" | "avatar_url"> | null;
  }[];
};

/** Subtarefa com data própria para as abas Hoje / Em breve da Agenda. */
export type SubtarefaAgendaItem = SubtarefaWithAuthors & {
  tarefa: Pick<Tarefa, "id" | "titulo"> | null;
  setor: Pick<Setor, "id" | "nome" | "cor"> | null;
  projeto: Pick<Projeto, "id" | "nome"> | null;
};

export type SubtarefaAgendaFilters = {
  usuario_id: string;
  data_inicio_de?: string;
  data_inicio_ate?: string;
  /** Agenda Hoje: `data_inicio` anterior a hoje (itens abertos com data vencida). */
  somente_atrasadas?: boolean;
  /**
   * Agenda Visualizando: subtarefas visíveis por herança da tarefa pai,
   * excluindo aquelas em que o usuário é responsável (da subtarefa ou da pai).
   */
  somente_visualizando?: boolean;
  search?: string;
  prioridade?: TarefaPrioridade | "all";
  setor_id?: string;
  projeto_id?: string;
  /** Filtro multi: subtarefa aparece se qualquer um destes for responsável */
  atribuido_ids?: string[];
};

export type SubtarefaMetaUpdate = {
  data_inicio?: string | null;
  atribuido_ids?: string[];
  visibilidade?: Subtarefa["visibilidade"];
};

export type SubtarefaFormData = {
  titulo: string;
  descricao: string;
  projeto_id: string | null;
  setor_id: string | null;
  atribuido_ids: string[];
  prioridade: TarefaPrioridade;
  data_inicio: string | null;
  recorrencia: RecorrenciaConfig | null;
  visibilidade: TarefaVisibilidade;
  observador_ids: string[];
  lembretes: TarefaLembreteOpcao[];
};

export type SubtarefaComentario = Tables<"subtarefa_comentarios"> & {
  usuario: Pick<Profile, "id" | "nome_completo" | "avatar_url" | "papel"> | null;
  editor?: Pick<Profile, "id" | "nome_completo" | "avatar_url"> | null;
};

export type SubtarefaDetail = SubtarefaWithAuthors & {
  observadores?: {
    usuario_id: string;
    usuario: Pick<Profile, "id" | "nome_completo" | "avatar_url"> | null;
  }[];
  comentarios: SubtarefaComentario[];
  anexos: SubtarefaAnexo[];
  tarefa: Pick<Tarefa, "id" | "titulo"> | null;
};

export type TarefaComentario = Tables<"tarefa_comentarios"> & {
  usuario: Pick<Profile, "id" | "nome_completo" | "avatar_url" | "papel"> | null;
  editor?: Pick<Profile, "id" | "nome_completo" | "avatar_url"> | null;
};

export type TarefaDetail = TarefaWithRelations & {
  subtarefas: SubtarefaWithAuthors[];
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
  porConclusao: { concluida: boolean; total: number }[];
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

export type AdminRestaurarSenhaData = {
  user_id: string;
  password: string;
};
