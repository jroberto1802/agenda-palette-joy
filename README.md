# CoreGestor

Aplicação web de gestão de tarefas e equipe (SPA com SSR via TanStack Start).  
Permite organizar agenda pessoal e compartilhada, projetos, avisos, calendário e permissões por papel.

## Stack

- **Frontend:** React 19 + TypeScript + TanStack Router / Start
- **UI:** Tailwind CSS 4 + shadcn/ui (Radix)
- **Estado servidor:** TanStack React Query
- **Backend / Auth / Storage:** Supabase (Postgres, Auth, Storage, Edge Functions, RLS)
- **Build:** Vite 8

## Funcionalidades principais

- **Agenda:** Hoje, Em breve, Agenda Geral, Visualizando — cards, lista e colunas
- **Tarefas e subtarefas:** prioridade, responsáveis, visualizadores, anexos, comentários, recorrência
- **Projetos:** detalhe com listagem de tarefas e membros
- **Equipe:** visão da agenda de outra pessoa (respeitando permissões)
- **Avisos, Calendário, Finalizados, Relatórios, Configurações e Admin**

## Pré-requisitos

- Node.js 20+ (ou Bun)
- Conta/projeto Supabase com as migrations aplicadas

## Configuração

1. Instale as dependências:

```bash
npm install
# ou: bun install
```

2. Copie o arquivo de ambiente:

```bash
cp .env.example .env.local
```

3. Preencha as variáveis:

| Variável | Uso |
| --- | --- |
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave anônima (frontend) |

Variáveis de CLI do Supabase (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`) ficam apenas para migrations — não use no frontend.

## Scripts

```bash
npm run dev        # servidor de desenvolvimento (http://localhost:8080)
npm run build      # build de produção (Vite + Nitro)
npm run preview    # preview do build
npm run lint       # ESLint
npm run format     # Prettier
```

Produção (após `npm run build`), conforme o preset Nitro:

```bash
node .output/server/index.mjs
```

## Estrutura

```
src/
├── components/     # UI por domínio (tarefas, avisos, projetos, layouts…)
├── hooks/          # Auth, profile, queries
├── routes/         # Rotas file-based (TanStack Router)
├── services/       # Acesso a API / Supabase
├── utils/          # Permissões, formatters, preferências
└── integrations/   # Cliente Supabase
supabase/
├── migrations/     # SQL / RLS
└── functions/      # Edge Functions
public/             # Favicon e estáticos
```

## Papéis

- **Admin** — acesso completo
- **Gerente** — gestão do setor e permissões amplas
- **Usuário** — operação no dia a dia (tarefas, projetos conforme visibilidade)
- **Visualizador** — leitura via regra de Visibilidade; pode comentar e anexar, sem editar campos nem concluir/excluir

## Banco e migrations

As policies e tabelas ficam em `supabase/migrations/`.  
Aplique com a CLI do Supabase no projeto correspondente antes de usar features novas em produção.

## Observações

- Preferências de visualização e classificação da agenda são salvas por usuário e por tela no `localStorage`.
- Não edite `src/integrations/supabase/client.ts` / tipos gerados do Supabase sem necessidade.
- Componentes em `src/components/ui/` seguem o padrão shadcn — evite alterações manuais desnecessárias.
