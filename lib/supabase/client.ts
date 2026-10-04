import { createBrowserClient } from "@supabase/ssr";

import { publicEnv } from "@/lib/env";

/**
 * Supabase client for use in Client Components (browser).
 * Uses the publishable/anon key; all data access is constrained by RLS.
 */
export function createClient() {
  const { supabaseUrl, supabasePublishableKey } = publicEnv();

  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
