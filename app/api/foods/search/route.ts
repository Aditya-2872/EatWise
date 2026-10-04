import { NextResponse, type NextRequest } from "next/server";

import { getUserContext } from "@/lib/auth/session";
import { searchFoodsCombined } from "@/lib/foods/service";
import { rateLimit } from "@/lib/rate-limit";
import { searchQuerySchema } from "@/lib/validation/logging";

export const dynamic = "force-dynamic";

/**
 * GET /api/foods/search?q=roti&limit=12
 * Combined internal + external (USDA/OFF) food search (spec §13.3).
 * Auth required; rate-limited (external APIs are expensive).
 */
export async function GET(req: NextRequest) {
  const ctx = await getUserContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`food-search:${ctx.userId}`, { limit: 30, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many searches. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const parsed = searchQuerySchema.safeParse({
    q: req.nextUrl.searchParams.get("q") ?? "",
    limit: req.nextUrl.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid query" },
      { status: 400 },
    );
  }

  try {
    const results = await searchFoodsCombined(parsed.data.q, {
      userId: ctx.userId,
      ...(parsed.data.limit ? { limit: parsed.data.limit } : {}),
    });
    return NextResponse.json({ results });
  } catch (err) {
    console.error("[api/foods/search]", err);
    return NextResponse.json(
      { error: "Food search is unavailable right now. Please try again." },
      { status: 503 },
    );
  }
}
