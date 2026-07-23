#!/usr/bin/env node
/**
 * Limpeza de dados inconsistentes da recorrência por série.
 *
 * Problema corrigido no app: subtarefas não têm recorrência própria.
 * Este script remove lixo já gravado no banco:
 *  - recorrencia preenchida em subtarefas
 *  - ocorrências da série em dias que não batem com a regra do modelo
 *  - ocorrências duplicadas no mesmo dia
 *  - subtarefas duplicadas (mesmo título) dentro da mesma ocorrência
 *
 * Uso:
 *   npm run limpar:serie              # só diagnóstico (não altera)
 *   npm run limpar:serie -- --apply   # aplica a limpeza
 *
 * Credenciais (ordem de preferência):
 *   1) --db-url "postgresql://..."
 *   2) SUPABASE_DB_URL / DATABASE_URL no .env.local
 *   3) SUPABASE_PROJECT_REF + SUPABASE_DB_PASSWORD (+ opcional SUPABASE_DB_HOST)
 *   4) fallback: supabase db query --linked
 *
 * Se a CLI não conectar (DNS/privilégio), cole o SQL no Dashboard:
 *   Supabase → SQL Editor → cole o arquivo correspondente em scripts/sql/
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const sqlDir = path.join(__dirname, "sql");

function loadEnvLocal() {
  const envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env) || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

function argValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  const prefix = `${flag}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

function buildDbUrl() {
  const fromArg = argValue("--db-url");
  if (fromArg) return fromArg;
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const ref = process.env.SUPABASE_PROJECT_REF;
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!ref || !password) return null;

  const user = process.env.SUPABASE_DB_USER || "postgres";
  const host = process.env.SUPABASE_DB_HOST || `db.${ref}.supabase.co`;
  const port = process.env.SUPABASE_DB_PORT || "5432";
  const database = process.env.SUPABASE_DB_NAME || "postgres";

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

loadEnvLocal();

const apply = process.argv.includes("--apply");
const file = apply
  ? path.join(sqlDir, "limpar-serie-recorrencia.apply.sql")
  : path.join(sqlDir, "limpar-serie-recorrencia.diagnostico.sql");

const dbUrl = buildDbUrl();
const queryArgs = dbUrl
  ? ["supabase", "db", "query", "--db-url", dbUrl, "-f", file]
  : ["supabase", "db", "query", "--linked", "-f", file];

console.log("");
console.log(apply ? "=== APPLY: limpeza de série/recorrência ===" : "=== DRY-RUN: diagnóstico (sem alterar) ===");
console.log(`Arquivo: ${path.relative(root, file)}`);
console.log(`Conexão: ${dbUrl ? "db-url" : "--linked"}`);
console.log("");

const result = spawnSync("npx", queryArgs, {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: process.env,
});

if (result.status !== 0) {
  console.error("\nFalha ao executar via CLI.");
  console.error("Rode o SQL manualmente no Supabase Dashboard → SQL Editor:");
  console.error(`  ${path.relative(root, file)}`);
  console.error("\nOu passe a connection string do Dashboard (Project Settings → Database):");
  console.error('  npm run limpar:serie -- --db-url "postgresql://postgres....."');
  if (!apply) {
    console.error("\nDepois do diagnóstico, aplique com:");
    console.error("  npm run limpar:serie -- --apply --db-url \"...\"");
  }
  process.exit(result.status ?? 1);
}

if (!apply) {
  console.log("\nPara aplicar a limpeza:");
  console.log("  npm run limpar:serie -- --apply");
} else {
  console.log("\nLimpeza aplicada. Recarregue Agenda / Em Breve / Calendário.");
}
