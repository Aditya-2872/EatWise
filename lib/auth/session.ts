import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface UserContext {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  timeZone: string;
}

/**
 * Resolve the authenticated user + their profile timezone from the server
 * session. Identity always comes from the session cookie, never from input.
 * Returns null when unauthenticated.
 */
export async function getUserContext(): Promise<UserContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .maybeSingle();

  return {
    supabase,
    userId: user.id,
    timeZone:
      (profile?.timezone as string | undefined) ??
      Intl.DateTimeFormat().resolvedOptions().timeZone ??
      "Asia/Kolkata",
  };
}
