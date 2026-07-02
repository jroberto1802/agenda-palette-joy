import { createClient } from "@supabase/supabase-js";

// URL e anon key são públicas por design — podem ficar no código.
const SUPABASE_URL = "https://aalhlizyiowvrtsmdpkc.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhbGhsaXp5aW93dnJ0c21kcGtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5ODE1MjcsImV4cCI6MjA5ODU1NzUyN30.TDkZrfC-0nYhKCpkpn6ShAPFG-t_ZP9EY1SIoG78rYg";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});
