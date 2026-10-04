import { NextResponse, type NextRequest } from "next/server";

import { getUserContext } from "@/lib/auth/session";
import { createLog, getDayIntake } from "@/lib/logging/service";
import { rateLimit } from "@/lib/rate-limit";
import { createLogSchema } from "@/lib/validation/logging";

export const dynamic = "force-dynamic";

/**
 * GET /api/logs?date=YYYY-MM-DD
 * Returns the day's logs grouped for the client (defaults to local today).
 */
export async function GET(req: NextRequest) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dateParam = req.nextUrl.searchParams.get("date");
  let date: string | undefined;
  if (dateParam) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
    }
    date = dateParam;
  }

  try {
    const day = await getDayIntake(ctx.supabase, ctx.userId, ctx.timeZone, date);
    return NextResponse.json(day);
  } catch (err) {
    console.error("[api/logs GET]", err);
    return NextResponse.json({ error: "Could not load logs." }, { status: 500 });
  }
}

/**
 * POST /api/logs — create one food log (deterministic snapshot computed server-side).
 */
export async function POST(req: NextRequest) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(`log-create:${ctx.userId}`, { limit: 60, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = createLogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid log payload." },
      { status: 400 },
    );
  }
  const v = parsed.data;

  try {
    const outcome = await createLog(
      ctx.supabase,
      ctx.userId,
      {
        foodId: v.foodId,
        quantity: v.quantity,
        unit: v.unit,
        ...(v.mealType ? { mealType: v.mealType } : {}),
        ...(v.loggedAt ? { loggedAt: v.loggedAt } : {}),
        ...(v.source ? { source: v.source } : {}),
        ...(v.confidence != null ? { confidence: v.confidence } : {}),
        ...(v.aiAnalysisId ? { aiAnalysisId: v.aiAnalysisId } : {}),
        ...(v.aiMetadata ? { aiMetadata: v.aiMetadata } : {}),
      },
      { timeZone: ctx.timeZone },
    );
    if (!outcome.ok) {
      const status = outcome.code === "FOOD_NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: outcome.message, code: outcome.code }, { status });
    }
    return NextResponse.json({ log: outcome.log, day: outcome.day }, { status: 201 });
  } catch (err) {
    console.error("[api/logs POST]", err);
    return NextResponse.json({ error: "Could not create the log." }, { status: 500 });
  }
}
