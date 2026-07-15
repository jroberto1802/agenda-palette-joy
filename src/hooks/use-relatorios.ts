import { useQuery } from "@tanstack/react-query";
import { relatorioKeys } from "@/lib/query-keys";
import { getRelatoriosData } from "@/services/relatorios";

export function useRelatorios(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: relatorioKeys.data(),
    queryFn: getRelatoriosData,
    enabled: options?.enabled ?? true,
  });
}
