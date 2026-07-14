import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { empresaKeys } from "@/lib/query-keys";
import { getEmpresaConfig, updateEmpresaConfig } from "@/services/empresa";
import type { EmpresaConfigFormData } from "@/types";

export function useEmpresaConfig() {
  return useQuery({
    queryKey: empresaKeys.config(),
    queryFn: getEmpresaConfig,
  });
}

export function useUpdateEmpresaConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: EmpresaConfigFormData) => updateEmpresaConfig(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(empresaKeys.config(), data);
      queryClient.invalidateQueries({ queryKey: empresaKeys.all });
    },
  });
}
