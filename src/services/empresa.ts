import { supabase } from "@/integrations/supabase/client";
import { removeEmpresaLogo, uploadEmpresaLogo } from "@/services/empresa-logos";
import type { EmpresaConfig, EmpresaConfigFormData } from "@/types";

export const EMPRESA_NOME_PADRAO = "Unida Construtora";

export async function getEmpresaConfig(): Promise<EmpresaConfig> {
  const { data, error } = await supabase
    .from("empresa_config")
    .select("*")
    .eq("id", "default")
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    return {
      id: "default",
      nome: EMPRESA_NOME_PADRAO,
      logo_url: null,
      updated_at: new Date().toISOString(),
      updated_por: null,
    };
  }

  return data;
}

export async function updateEmpresaConfig(
  payload: EmpresaConfigFormData,
): Promise<EmpresaConfig> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  const trimmed = payload.nome.trim();
  if (!trimmed) throw new Error("Informe o nome da empresa.");

  const current = await getEmpresaConfig();
  let logoUrl = current.logo_url;

  if (payload.remove_logo && logoUrl) {
    await removeEmpresaLogo(logoUrl);
    logoUrl = null;
  }

  if (payload.logo_file) {
    logoUrl = await uploadEmpresaLogo(payload.logo_file, logoUrl);
  }

  const { data, error } = await supabase
    .from("empresa_config")
    .update({
      nome: trimmed,
      logo_url: logoUrl,
      updated_por: user.id,
    })
    .eq("id", "default")
    .select("*")
    .single();

  if (error) throw error;
  return data;
}
