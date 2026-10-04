import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { serverEnv } from "@/lib/env";

let cached: ReturnType<typeof createSupabaseClient> | null = null;

/**
 * Service-role client. BYPASSES ROW LEVEL SECURITY.
 *
 * Server-only. Use narrowly (admin data access, seeding external food data
 * into the shared tables). Never import from a Client Component and never
 * pass this client into anything rendered or serialized to the browser.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient() must only be called on the server.");
  }
  if (cached) return cached;

  const { supabaseUrl, supabaseServiceRoleKey } = serverEnv();
  if (!supabaseServiceRoleKey) {
    throw new Error(
      "Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY. " +
        "Find it under Supabase Dashboard → Settings → API (secret key).",
    );
  }

  cached = createSupabaseClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
