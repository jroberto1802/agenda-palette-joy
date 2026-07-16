import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SENHA_TEMPORARIA_DIAS = 3;

type RestaurarSenhaBody = {
  user_id: string;
  password: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabaseUser
      .from("profiles")
      .select("papel")
      .eq("id", user.id)
      .single();

    const callerPapel = profile?.papel;
    if (callerPapel !== "admin" && callerPapel !== "gerente") {
      return new Response(
        JSON.stringify({
          error: "Apenas administradores e gestores podem restaurar senhas.",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = (await req.json()) as RestaurarSenhaBody;
    const { user_id, password } = body;

    if (!user_id || !password) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: user_id, password" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (typeof password !== "string" || password.length < 6) {
      return new Response(
        JSON.stringify({ error: "A senha temporária deve ter pelo menos 6 caracteres." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: target, error: targetError } = await supabaseAdmin
      .from("profiles")
      .select("id, papel, nome_completo")
      .eq("id", user_id)
      .maybeSingle();

    if (targetError) throw targetError;
    if (!target) {
      return new Response(JSON.stringify({ error: "Usuário não encontrado." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gestor não pode restaurar senha de Administrador.
    if (callerPapel === "gerente" && target.papel === "admin") {
      return new Response(
        JSON.stringify({
          error: "Gestores não podem restaurar a senha de administradores.",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Gestor só pode restaurar Gestores e Usuários.
    if (
      callerPapel === "gerente" &&
      target.papel !== "gerente" &&
      target.papel !== "usuario"
    ) {
      return new Response(
        JSON.stringify({
          error: "Gestores só podem restaurar senha de Gestores e Usuários.",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      { password },
    );
    if (updateAuthError) throw updateAuthError;

    const expiraEm = new Date();
    expiraEm.setDate(expiraEm.getDate() + SENHA_TEMPORARIA_DIAS);

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        senha_temporaria: true,
        senha_temporaria_expira_em: expiraEm.toISOString(),
      })
      .eq("id", user_id);

    if (profileError) throw profileError;

    return new Response(
      JSON.stringify({
        ok: true,
        senha_temporaria_expira_em: expiraEm.toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
