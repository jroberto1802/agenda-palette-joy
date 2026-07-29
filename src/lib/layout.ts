/** Grid padrão de cards: 1 coluna (mobile), 2 (médio), 3 (desktop) — igual ao Mural de Avisos. */
export const CARD_GRID_CLASS = "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3";

/**
 * Grade densa (tarefas, projetos): 4 por linha no desktop, responsivo abaixo.
 * 1 coluna (mobile), 2 (sm), 4 (lg+).
 */
export const DENSE_CARD_GRID_CLASS =
  "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4";

/**
 * Altura fixa dos cards de tarefa/subtarefa na grade (igual ao skeleton da Agenda).
 * Conteúdo variável trunca — não altera as dimensões do card.
 */
export const TAREFA_CARD_FIXED_CLASS = "h-36 w-full overflow-hidden";

/** @deprecated Prefira `DENSE_CARD_GRID_CLASS`. */
export const TAREFA_CARD_GRID_CLASS = DENSE_CARD_GRID_CLASS;

/** Modal centralizado grande (~90% da viewport), com margem de overlay ao redor. */
export const LARGE_MODAL_CONTENT_CLASS =
  "flex h-[90vh] w-[90vw] max-w-[90vw] flex-col gap-0 overflow-hidden rounded-xl p-0 sm:rounded-xl";

/**
 * Painel lateral de subtarefa: mesma altura do modal de tarefa (90vh),
 * largura pré-compactação, ancorado à direita com cantos arredondados à esquerda.
 */
export const SUBTAREFA_PANEL_CONTENT_CLASS =
  "flex !top-[5vh] !bottom-auto !h-[90vh] w-full flex-col gap-0 overflow-hidden rounded-l-xl rounded-r-none border-l p-0 sm:max-w-xl md:max-w-2xl lg:max-w-3xl z-[70] [&>button]:right-3 [&>button]:top-3";
