import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PessoasMultiSelect } from "@/components/common/pessoas-multi-select";
import type {
  ProfileWithSetor,
  Projeto,
  SetorWithGerente,
  TarefaFilters,
} from "@/types";
import {
  TAREFA_CLASSIFICAR_HINTS,
  TAREFA_CLASSIFICAR_LABELS,
  type TarefaClassificar,
} from "@/utils/agenda-classificar-preference";
import { TAREFA_PRIORIDADE_LABELS } from "@/utils/tarefas";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const filterControlClass = "h-9 w-[168px] shrink-0";
const SEARCH_DEBOUNCE_MS = 400;

export function TarefaFiltersBar({
  filters,
  onChange,
  setores,
  projetos,
  pessoas,
  hideResponsavel = false,
  hideProjeto = false,
  /** Menu Finalizados: período por data de finalização; sem prioridade/tag/classificar */
  /** Menu Hoje: busca + prioridade + setor + projeto + classificar (prioridade+hora / hora) */
  /** Menu Visualizando: busca + prioridade + setor + responsáveis + classificar */
  variant = "default",
  /** Opções do filtro Classificar. Vazio = oculto. */
  classificarOptions = ["prioridade", "data_asc"] as TarefaClassificar[],
}: {
  filters: TarefaFilters;
  onChange: (filters: TarefaFilters) => void;
  setores: SetorWithGerente[];
  projetos: Pick<Projeto, "id" | "nome">[];
  pessoas: ProfileWithSetor[];
  hideResponsavel?: boolean;
  hideProjeto?: boolean;
  variant?: "default" | "finalizados" | "hoje" | "visualizando";
  classificarOptions?: TarefaClassificar[];
}) {
  const atribuidoIds = filters.atribuido_ids ?? [];
  const isFinalizados = variant === "finalizados";
  const isHoje = variant === "hoje";
  const isVisualizando = variant === "visualizando";
  const showProjeto = !hideProjeto && !isVisualizando;
  const showResponsavel = !hideResponsavel && !isHoje;
  const showPrioridade = !isFinalizados;
  const showClassificar = !isFinalizados && classificarOptions.length > 0;
  const classificarValue =
    filters.classificar && classificarOptions.includes(filters.classificar)
      ? filters.classificar
      : (classificarOptions[0] ?? "prioridade");
  const classificarHint = TAREFA_CLASSIFICAR_HINTS[classificarValue];

  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const searchFocusedRef = useRef(false);

  /** Estado local evita engolir caracteres enquanto o pai re-renderiza / refetch. */
  const [search, setSearch] = useState(filters.search ?? "");

  useEffect(() => {
    if (searchFocusedRef.current) return;
    setSearch(filters.search ?? "");
  }, [filters.search]);

  useEffect(() => {
    const parentSearch = filtersRef.current.search ?? "";
    if (search === parentSearch) return;

    const timeout = window.setTimeout(() => {
      onChangeRef.current({ ...filtersRef.current, search });
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [search]);

  const patchFilters = (patch: Partial<TarefaFilters>) => {
    onChange({ ...filtersRef.current, search, ...patch });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative w-full min-w-[220px] max-w-full grow basis-[220px] sm:w-[280px] sm:max-w-[320px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar título, descrição ou comentário..."
          className="pl-9"
          value={search}
          onFocus={() => {
            searchFocusedRef.current = true;
          }}
          onBlur={() => {
            searchFocusedRef.current = false;
            const parentSearch = filtersRef.current.search ?? "";
            if (search !== parentSearch) {
              onChangeRef.current({ ...filtersRef.current, search });
            }
          }}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {showClassificar && (
        <TooltipProvider delayDuration={400}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Select
                  value={classificarValue}
                  onValueChange={(v) =>
                    patchFilters({ classificar: v as TarefaClassificar })
                  }
                >
                  <SelectTrigger className={filterControlClass} aria-label="Classificar">
                    <SelectValue placeholder="Classificar" />
                  </SelectTrigger>
                  <SelectContent>
                    {classificarOptions.map((option) => (
                      <SelectItem key={option} value={option} title={TAREFA_CLASSIFICAR_HINTS[option]}>
                        {TAREFA_CLASSIFICAR_LABELS[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TooltipTrigger>
            {classificarHint && (
              <TooltipContent side="bottom" className="max-w-xs text-xs">
                {classificarHint}
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      )}

      {showPrioridade && (
        <Select
          value={filters.prioridade ?? "all"}
          onValueChange={(v) =>
            patchFilters({ prioridade: v as TarefaFilters["prioridade"] })
          }
        >
          <SelectTrigger className={filterControlClass}>
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas prioridades</SelectItem>
            {Object.entries(TAREFA_PRIORIDADE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select
        value={filters.setor_id ?? "all"}
        onValueChange={(v) => patchFilters({ setor_id: v })}
      >
        <SelectTrigger className={filterControlClass}>
          <SelectValue placeholder="Setor" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os setores</SelectItem>
          {setores.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showProjeto && (
        <Select
          value={filters.projeto_id ?? "all"}
          onValueChange={(v) => patchFilters({ projeto_id: v })}
        >
          <SelectTrigger className={filterControlClass}>
            <SelectValue placeholder="Projeto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os projetos</SelectItem>
            {projetos.map((projeto) => (
              <SelectItem key={projeto.id} value={projeto.id}>
                {projeto.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {showResponsavel && (
        <div className="w-[180px] shrink-0 [&>button]:h-9">
          <PessoasMultiSelect
            pessoas={pessoas}
            value={atribuidoIds}
            onChange={(ids) =>
              patchFilters({
                atribuido_ids: ids,
                atribuido_a: "all",
              })
            }
            placeholder="Todos responsáveis"
            showSelectAll
          />
        </div>
      )}

      {isFinalizados ? (
        <>
          <Input
            type="date"
            aria-label="Período — de"
            title="Data de conclusão — de"
            className="h-9 w-[148px] shrink-0"
            value={filters.periodo_inicio ?? ""}
            onChange={(e) => patchFilters({ periodo_inicio: e.target.value })}
          />
          <Input
            type="date"
            aria-label="Período — até"
            title="Data de conclusão — até"
            className="h-9 w-[148px] shrink-0"
            value={filters.periodo_fim ?? ""}
            onChange={(e) => patchFilters({ periodo_fim: e.target.value })}
          />
        </>
      ) : null}
    </div>
  );
}
