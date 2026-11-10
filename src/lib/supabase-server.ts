import { createClient } from "@supabase/supabase-js";
import { getRequestHeader } from "@tanstack/react-start/server";
import { supabaseUrl, supabasePublishableKey } from "@/lib/supabase";

// A fresh client per request keeps sessions isolated and enforces database RLS.
export async function getAuthenticatedClient() {
  const authorization = getRequestHeader("authorization");
  const token = authorization?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) throw new Error("Please sign in to continue.");
  const client = createClient(supabaseUrl, supabasePublishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new Error("Your session has expired. Please sign in again.");
  return client;
}
