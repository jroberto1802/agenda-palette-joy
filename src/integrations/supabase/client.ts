import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? "https://aalhlizyiowvrtsmdpkc.supabase.co";

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhbGhsaXp5aW93dnJ0c21kcGtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5ODE1MjcsImV4cCI6MjA5ODU1NzUyN30.TDkZrfC-0nYhKCpkpn6ShAPFG-t_ZP9EY1SIoG78rYg";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});
