export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      aviso_comentarios: {
        Row: {
          aviso_id: string;
          conteudo: string;
          created_at: string;
          id: string;
          usuario_id: string | null;
        };
        Insert: {
          aviso_id: string;
          conteudo: string;
          created_at?: string;
          id?: string;
          usuario_id?: string | null;
        };
        Update: {
          aviso_id?: string;
          conteudo?: string;
          created_at?: string;
          id?: string;
          usuario_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "aviso_comentarios_aviso_id_fkey",
            columns: ["aviso_id"],
            isOneToOne: false,
            referencedRelation: "avisos",
            referencedColumns: ["id"],
          },
          {
            foreignKeyName: "aviso_comentarios_usuario_id_fkey",
            columns: ["usuario_id"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"],
          },
        ];
      };
      aviso_lido_por: {
        Row: {
          aviso_id: string;
          lido_em: string;
          usuario_id: string;
        };
        Insert: {
          aviso_id: string;
          lido_em?: string;
          usuario_id: string;
        };
        Update: {
          aviso_id?: string;
          lido_em?: string;
          usuario_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "aviso_lido_por_aviso_id_fkey",
            columns: ["aviso_id"],
            isOneToOne: false,
            referencedRelation: "avisos",
            referencedColumns: ["id"],
          },
          {
            foreignKeyName: "aviso_lido_por_usuario_id_fkey",
            columns: ["usuario_id"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"],
          },
        ];
      };
      aviso_pessoas: {
        Row: {
          aviso_id: string;
          usuario_id: string;
        };
        Insert: {
          aviso_id: string;
          usuario_id: string;
        };
        Update: {
          aviso_id?: string;
          usuario_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "aviso_pessoas_aviso_id_fkey",
            columns: ["aviso_id"],
            isOneToOne: false,
            referencedRelation: "avisos",
            referencedColumns: ["id"],
          },
          {
            foreignKeyName: "aviso_pessoas_usuario_id_fkey",
            columns: ["usuario_id"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"],
          },
        ];
      };
      aviso_setores: {
        Row: {
          aviso_id: string;
          setor_id: string;
        };
        Insert: {
          aviso_id: string;
          setor_id: string;
        };
        Update: {
          aviso_id?: string;
          setor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "aviso_setores_aviso_id_fkey",
            columns: ["aviso_id"],
            isOneToOne: false,
            referencedRelation: "avisos",
            referencedColumns: ["id"],
          },
          {
            foreignKeyName: "aviso_setores_setor_id_fkey",
            columns: ["setor_id"],
            isOneToOne: false,
            referencedRelation: "setores",
            referencedColumns: ["id"],
          },
        ];
      };
      avisos: {
        Row: {
          alcance: "todos" | "por_setor" | "pessoa_especifica";
          comentarios_permitidos: boolean;
          conteudo: string;
          created_at: string;
          criado_por: string | null;
          data_publicacao: string;
          fixado: boolean;
          id: string;
          titulo: string;
          updated_at: string;
        };
        Insert: {
          alcance: "todos" | "por_setor" | "pessoa_especifica";
          comentarios_permitidos?: boolean;
          conteudo: string;
          created_at?: string;
          criado_por?: string | null;
          data_publicacao?: string;
          fixado?: boolean;
          id?: string;
          titulo: string;
          updated_at?: string;
        };
        Update: {
          alcance?: "todos" | "por_setor" | "pessoa_especifica";
          comentarios_permitidos?: boolean;
          conteudo?: string;
          created_at?: string;
          criado_por?: string | null;
          data_publicacao?: string;
          fixado?: boolean;
          id?: string;
          titulo?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "avisos_criado_por_fkey",
            columns: ["criado_por"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"],
          },
        ];
      };
      notificacoes: {
        Row: {
          created_at: string;
          id: string;
          lida: boolean;
          referencia_id: string | null;
          referencia_tipo: string | null;
          tipo: string;
          usuario_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          lida?: boolean;
          referencia_id?: string | null;
          referencia_tipo?: string | null;
          tipo: string;
          usuario_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          lida?: boolean;
          referencia_id?: string | null;
          referencia_tipo?: string | null;
          tipo?: string;
          usuario_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notificacoes_usuario_id_fkey",
            columns: ["usuario_id"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"],
          },
        ];
      };
      profiles: {
        Row: {
          ativo: boolean;
          avatar_url: string | null;
          cargo: string | null;
          created_at: string;
          email: string | null;
          gestor_id: string | null;
          id: string;
          nome_completo: string;
          papel: "admin" | "gerente" | "usuario" | "visualizador";
          setor_id: string | null;
          updated_at: string;
        };
        Insert: {
          ativo?: boolean;
          avatar_url?: string | null;
          cargo?: string | null;
          created_at?: string;
          email?: string | null;
          gestor_id?: string | null;
          id: string;
          nome_completo: string;
          papel?: "admin" | "gerente" | "usuario" | "visualizador";
          setor_id?: string | null;
          updated_at?: string;
        };
        Update: {
          ativo?: boolean;
          avatar_url?: string | null;
          cargo?: string | null;
          created_at?: string;
          email?: string | null;
          gestor_id?: string | null;
          id?: string;
          nome_completo?: string;
          papel?: "admin" | "gerente" | "usuario" | "visualizador";
          setor_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_gestor_id_fkey",
            columns: ["gestor_id"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"],
          },
          {
            foreignKeyName: "profiles_setor_id_fkey",
            columns: ["setor_id"],
            isOneToOne: false,
            referencedRelation: "setores",
            referencedColumns: ["id"],
          },
        ];
      };
      setores: {
        Row: {
          cor: string | null;
          created_at: string;
          descricao: string | null;
          gerente_id: string | null;
          id: string;
          nome: string;
          updated_at: string;
        };
        Insert: {
          cor?: string | null;
          created_at?: string;
          descricao?: string | null;
          gerente_id?: string | null;
          id?: string;
          nome: string;
          updated_at?: string;
        };
        Update: {
          cor?: string | null;
          created_at?: string;
          descricao?: string | null;
          gerente_id?: string | null;
          id?: string;
          nome?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "setores_gerente_id_fkey",
            columns: ["gerente_id"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"],
          },
        ];
      };
      subtarefas: {
        Row: {
          concluida: boolean;
          created_at: string;
          id: string;
          tarefa_id: string;
          titulo: string;
        };
        Insert: {
          concluida?: boolean;
          created_at?: string;
          id?: string;
          tarefa_id: string;
          titulo: string;
        };
        Update: {
          concluida?: boolean;
          created_at?: string;
          id?: string;
          tarefa_id?: string;
          titulo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subtarefas_tarefa_id_fkey",
            columns: ["tarefa_id"],
            isOneToOne: false,
            referencedRelation: "tarefas",
            referencedColumns: ["id"],
          },
        ];
      };
      tarefa_anexos: {
        Row: {
          created_at: string;
          id: string;
          nome: string;
          storage_path: string;
          tamanho: number | null;
          tarefa_id: string;
          tipo: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          nome: string;
          storage_path: string;
          tamanho?: number | null;
          tarefa_id: string;
          tipo?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          nome?: string;
          storage_path?: string;
          tamanho?: number | null;
          tarefa_id?: string;
          tipo?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tarefa_anexos_tarefa_id_fkey",
            columns: ["tarefa_id"],
            isOneToOne: false,
            referencedRelation: "tarefas",
            referencedColumns: ["id"],
          },
        ];
      };
      tarefa_comentarios: {
        Row: {
          conteudo: string;
          created_at: string;
          id: string;
          tarefa_id: string;
          usuario_id: string | null;
        };
        Insert: {
          conteudo: string;
          created_at?: string;
          id?: string;
          tarefa_id: string;
          usuario_id?: string | null;
        };
        Update: {
          conteudo?: string;
          created_at?: string;
          id?: string;
          tarefa_id?: string;
          usuario_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tarefa_comentarios_tarefa_id_fkey",
            columns: ["tarefa_id"],
            isOneToOne: false,
            referencedRelation: "tarefas",
            referencedColumns: ["id"],
          },
          {
            foreignKeyName: "tarefa_comentarios_usuario_id_fkey",
            columns: ["usuario_id"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"],
          },
        ];
      };
      tarefa_historico: {
        Row: {
          campo: string;
          created_at: string;
          id: string;
          tarefa_id: string;
          usuario_id: string | null;
          valor_anterior: string | null;
          valor_novo: string | null;
        };
        Insert: {
          campo: string;
          created_at?: string;
          id?: string;
          tarefa_id: string;
          usuario_id?: string | null;
          valor_anterior?: string | null;
          valor_novo?: string | null;
        };
        Update: {
          campo?: string;
          created_at?: string;
          id?: string;
          tarefa_id?: string;
          usuario_id?: string | null;
          valor_anterior?: string | null;
          valor_novo?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tarefa_historico_tarefa_id_fkey",
            columns: ["tarefa_id"],
            isOneToOne: false,
            referencedRelation: "tarefas",
            referencedColumns: ["id"],
          },
          {
            foreignKeyName: "tarefa_historico_usuario_id_fkey",
            columns: ["usuario_id"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"],
          },
        ];
      };
      tarefa_observadores: {
        Row: {
          tarefa_id: string;
          usuario_id: string;
        };
        Insert: {
          tarefa_id: string;
          usuario_id: string;
        };
        Update: {
          tarefa_id?: string;
          usuario_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tarefa_observadores_tarefa_id_fkey",
            columns: ["tarefa_id"],
            isOneToOne: false,
            referencedRelation: "tarefas",
            referencedColumns: ["id"],
          },
          {
            foreignKeyName: "tarefa_observadores_usuario_id_fkey",
            columns: ["usuario_id"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"],
          },
        ];
      };
      tarefas: {
        Row: {
          atribuido_a: string | null;
          created_at: string;
          criado_por: string | null;
          data_conclusao: string | null;
          data_inicio: string | null;
          data_vencimento: string | null;
          deleted_at: string | null;
          descricao: string | null;
          id: string;
          lembretes: Json;
          prioridade: "P1" | "P2" | "P3" | "P4";
          recorrencia: Json | null;
          setor_id: string | null;
          status: "a_fazer" | "em_andamento" | "bloqueada" | "concluida";
          tags: string[];
          titulo: string;
          updated_at: string;
          visibilidade:
            | "todos_empresa"
            | "todos_setor"
            | "somente_para_mim"
            | "pessoas_especificas";
        };
        Insert: {
          atribuido_a?: string | null;
          created_at?: string;
          criado_por?: string | null;
          data_conclusao?: string | null;
          data_inicio?: string | null;
          data_vencimento?: string | null;
          deleted_at?: string | null;
          descricao?: string | null;
          id?: string;
          lembretes?: Json;
          prioridade?: "P1" | "P2" | "P3" | "P4";
          recorrencia?: Json | null;
          setor_id?: string | null;
          status?: "a_fazer" | "em_andamento" | "bloqueada" | "concluida";
          tags?: string[];
          titulo: string;
          updated_at?: string;
          visibilidade?:
            | "todos_empresa"
            | "todos_setor"
            | "somente_para_mim"
            | "pessoas_especificas";
        };
        Update: {
          atribuido_a?: string | null;
          created_at?: string;
          criado_por?: string | null;
          data_conclusao?: string | null;
          data_inicio?: string | null;
          data_vencimento?: string | null;
          deleted_at?: string | null;
          descricao?: string | null;
          id?: string;
          lembretes?: Json;
          prioridade?: "P1" | "P2" | "P3" | "P4";
          recorrencia?: Json | null;
          setor_id?: string | null;
          status?: "a_fazer" | "em_andamento" | "bloqueada" | "concluida";
          tags?: string[];
          titulo?: string;
          updated_at?: string;
          visibilidade?:
            | "todos_empresa"
            | "todos_setor"
            | "somente_para_mim"
            | "pessoas_especificas";
        };
        Relationships: [
          {
            foreignKeyName: "tarefas_setor_id_fkey",
            columns: ["setor_id"],
            isOneToOne: false,
            referencedRelation: "setores",
            referencedColumns: ["id"],
          },
          {
            foreignKeyName: "tarefas_criado_por_fkey",
            columns: ["criado_por"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"],
          },
          {
            foreignKeyName: "tarefas_atribuido_a_fkey",
            columns: ["atribuido_a"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"],
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      notify_user: {
        Args: {
          p_usuario_id: string;
          p_tipo: string;
          p_referencia_tipo?: string | null;
          p_referencia_id?: string | null;
        };
        Returns: void;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
