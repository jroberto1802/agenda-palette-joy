import { useQuery } from "@tanstack/react-query";
import { relatorioKeys } from "@/lib/query-keys";
import { getRelatoriosData } from "@/services/relatorios";

export function useRelatorios() {
  return useQuery({
    queryKey: relatorioKeys.data(),
    queryFn: getRelatoriosData,
  });
}
