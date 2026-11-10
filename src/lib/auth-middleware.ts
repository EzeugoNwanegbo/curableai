import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/lib/supabase";

// Every server function forwards the caller's token; identity is checked on the server.
export const authMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) throw new Error("Please sign in to continue.");
    return next({ headers: { Authorization: `Bearer ${data.session.access_token}` } });
  })
  .server(async ({ next }) => {
    const { getAuthenticatedClient } = await import("@/lib/supabase-server");
    await getAuthenticatedClient();
    return next();
  });
