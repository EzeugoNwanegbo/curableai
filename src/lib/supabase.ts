import { createClient } from "@supabase/supabase-js";

// Supabase Configuration
// Using static import.meta.env for Vite (client) and process.env for Node (server)
const runtimeEnv = typeof process !== "undefined" ? process.env : {};
export const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  runtimeEnv.VITE_SUPABASE_URL ||
  runtimeEnv.SUPABASE_URL ||
  "";
export const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  runtimeEnv.VITE_SUPABASE_PUBLISHABLE_KEY ||
  runtimeEnv.SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  runtimeEnv.VITE_SUPABASE_ANON_KEY ||
  runtimeEnv.SUPABASE_ANON_KEY ||
  "";
export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase = createClient(
  supabaseUrl || "http://127.0.0.1:54321",
  supabasePublishableKey || "demo-unconfigured",
  {
    auth: {
      persistSession: typeof window !== "undefined",
      autoRefreshToken: typeof window !== "undefined",
    },
  },
);
