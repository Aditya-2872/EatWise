import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { publicEnv } from "@/lib/env";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Cookie-based SSR auth per @supabase/ssr guidance; identity is always
 * derived from this server session, never from client input.
 */
export async function createClient() {
  const { supabaseUrl, supabasePublishableKey } = publicEnv();
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component — safe to ignore when middleware
          // (proxy) is refreshing sessions.
        }
      },
    },
  });
}
