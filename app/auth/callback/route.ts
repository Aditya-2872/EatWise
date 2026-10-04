import { NextResponse } from "next/server";

import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Handles the OAuth / magic-link code exchange (PKCE flow).
 * Supabase redirects here with ?code=... after provider sign-in.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/app/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const appUrl = publicEnv().appUrl;
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      }
      if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      }
      return NextResponse.redirect(`${appUrl}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=auth-code-error`,
  );
}
