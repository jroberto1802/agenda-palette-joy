import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-region",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CreateUserBody = {
  email: string;
  password: string;
  nome_completo: string;
  papel?: string;
  setor_id?: string | null;
  gestor_id?: string | null;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function mapCreateUserError(err: unknown): string {
  const message = err instanceof Error ? err.message : "Erro desconhecido";
  const lower = message.toLowerCase();

  if (lower.includes("already") || lower.includes("registered") || lower.includes("exists")) {
    return "Já existe uma pessoa cadastrada com este e-mail.";
  }
  if (
    lower.includes("leaked") ||
    lower.includes("pwned") ||
    lower.includes("have i been") ||
    lower.includes("easy to guess")
  ) {
    return "Esta senha é muito comum ou já apareceu em vazamentos. Escolha outra senha provisória.";
  }
  if (
    lower.includes("password") &&
    (lower.includes("at least") ||
      lower.includes("too short") ||
      lower.includes("characters") ||
      lower.includes("weak"))
  ) {
    return "A senha não atende à política do sistema. Use uma senha mais longa e segura.";
  }
  if (lower.includes("database error creating new user")) {
    return "Não foi possível criar o usuário. Verifique se o e-mail já está em uso.";
  }

  return message;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Não autenticado" }, 401);
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      },
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: "Não autenticado" }, 401);
    }

    const { data: profile } = await supabaseUser
      .from("profiles")
      .select("papel")
      .eq("id", user.id)
      .single();

    const callerPapel = profile?.papel;
    if (callerPapel !== "admin" && callerPapel !== "gerente") {
      return jsonResponse(
        { error: "Apenas administradores e gestores podem criar usuários" },
        403,
      );
    }

    const body = (await req.json()) as CreateUserBody;
    const {
      email,
      password,
      nome_completo,
      papel = "usuario",
      setor_id = null,
      gestor_id = null,
    } = body;

    if (!email || !password || !nome_completo) {
      return jsonResponse(
        { error: "Campos obrigatórios: email, password, nome_completo" },
        400,
      );
    }

    if (typeof password !== "string" || password.length < 6) {
      return jsonResponse(
        { error: "A senha provisória deve ter pelo menos 6 caracteres." },
        400,
      );
    }

    if (!papel) {
      return jsonResponse({ error: "Papel é obrigatório." }, 400);
    }

    // Gestor não pode criar administradores
    if (callerPapel === "gerente" && papel === "admin") {
      return jsonResponse({ error: "Gestores não podem criar administradores." }, 403);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("email", email.trim())
      .maybeSingle();

    if (existingProfile) {
      return jsonResponse(
        { error: "Já existe uma pessoa cadastrada com este e-mail." },
        400,
      );
    }

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: { nome_completo, papel },
    });

    if (createError) {
      return jsonResponse({ error: mapCreateUserError(createError) }, 400);
    }

    const validPapeis = ["admin", "gerente", "usuario", "visualizador"];
    const assignedPapel = validPapeis.includes(papel) ? papel : "usuario";

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        nome_completo,
        email: email.trim().toLowerCase(),
        papel: assignedPapel,
        setor_id: setor_id || null,
        gestor_id: gestor_id || null,
        ativo: true,
      })
      .eq("id", newUser.user.id);

    if (profileError) throw profileError;

    return jsonResponse({ user_id: newUser.user.id });
  } catch (err) {
    return jsonResponse({ error: mapCreateUserError(err) }, 400);
  }
});
