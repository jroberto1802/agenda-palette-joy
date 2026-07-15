import { Search } from "lucide-react";
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
import { TAREFA_PRIORIDADE_LABELS } from "@/utils/tarefas";

const filterControlClass = "h-9 w-[148px] shrink-0";

export function TarefaFiltersBar({
  filters,
  onChange,
  setores,
  projetos,
  pessoas,
  hideResponsavel = false,
  hideProjeto = false,
  /** Menu Finalizados: período por data de finalização */
  variant = "default",
}: {
  filters: TarefaFilters;
  onChange: (filters: TarefaFilters) => void;
  setores: SetorWithGerente[];
  projetos: Pick<Projeto, "id" | "nome">[];
  pessoas: ProfileWithSetor[];
  hideResponsavel?: boolean;
  hideProjeto?: boolean;
  variant?: "default" | "finalizados";
}) {
  const atribuidoIds = filters.atribuido_ids ?? [];
  const isFinalizados = variant === "finalizados";

  return (
    <div className="-mx-1 overflow-x-auto pb-1">
      <div className="flex w-max min-w-full items-center gap-3 px-1">
        <div className="relative w-[220px] shrink-0 grow basis-[200px] sm:w-[240px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={isFinalizados ? "Buscar por título..." : "Buscar tarefas..."}
            className="pl-9"
            value={filters.search ?? ""}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
          />
        </div>

        <Select
          value={filters.prioridade ?? "all"}
          onValueChange={(v) =>
            onChange({ ...filters, prioridade: v as TarefaFilters["prioridade"] })
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

        <Select
          value={filters.setor_id ?? "all"}
          onValueChange={(v) => onChange({ ...filters, setor_id: v })}
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

        {!hideProjeto && (
          <Select
            value={filters.projeto_id ?? "all"}
            onValueChange={(v) => onChange({ ...filters, projeto_id: v })}
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

        {!hideResponsavel && (
          <div className="w-[180px] shrink-0 [&>button]:h-9">
            <PessoasMultiSelect
              pessoas={pessoas}
              value={atribuidoIds}
              onChange={(ids) =>
                onChange({
                  ...filters,
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
              onChange={(e) => onChange({ ...filters, periodo_inicio: e.target.value })}
            />
            <Input
              type="date"
              aria-label="Período — até"
              title="Data de conclusão — até"
              className="h-9 w-[148px] shrink-0"
              value={filters.periodo_fim ?? ""}
              onChange={(e) => onChange({ ...filters, periodo_fim: e.target.value })}
            />
          </>
        ) : (
          <Input
            placeholder="Filtrar por tag..."
            className="w-[160px] shrink-0"
            value={filters.tag ?? ""}
            onChange={(e) => onChange({ ...filters, tag: e.target.value })}
          />
        )}
      </div>
    </div>
  );
}
