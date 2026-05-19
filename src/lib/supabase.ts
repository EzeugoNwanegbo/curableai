import { createClient } from '@supabase/supabase-js'

// Supabase Configuration
// Using static import.meta.env for Vite (client) and process.env for Node (server)
const runtimeEnv = typeof process !== 'undefined' ? process.env : {}
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || runtimeEnv.VITE_SUPABASE_URL || runtimeEnv.SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || runtimeEnv.VITE_SUPABASE_ANON_KEY || runtimeEnv.SUPABASE_ANON_KEY || ''
const supabaseServiceKey = runtimeEnv.SUPABASE_SERVICE_ROLE_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Use service role for backend safety layer - ONLY on server and ONLY if key is provided
export const supabaseAdmin = (typeof window === 'undefined' && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null
