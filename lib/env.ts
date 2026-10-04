/**
 * Central environment configuration.
 *
 * Per PROJECT_SPEC §42 "Do not fake integrations": every accessor throws a
 * clear configuration error naming the missing variable instead of silently
 * degrading.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Copy .env.example to .env.local and fill it in (see README).`,
    );
  }
  return value.trim();
}

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

/** Browser-safe variables only. */
export function publicEnv() {
  return {
    supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL"),
    supabasePublishableKey: required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    appUrl: optional("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000",
  };
}

/** Server-only variables. Never import from a Client Component. */
export function serverEnv() {
  return {
    supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL"),
    supabasePublishableKey: required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    supabaseServiceRoleKey: optional("SUPABASE_SERVICE_ROLE_KEY"),
    aiProvider: (optional("AI_PROVIDER") ?? "gemini") as "gemini" | "mock",
    aiApiKey: optional("AI_API_KEY"),
    aiVisionModel: optional("AI_VISION_MODEL"),
    aiLanguageModel: optional("AI_LANGUAGE_MODEL"),
    usdaApiKey: optional("FOOD_API_KEY"),
    offContactEmail: optional("OFF_CONTACT_EMAIL"),
    nodeEnv: process.env.NODE_ENV,
  };
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}
