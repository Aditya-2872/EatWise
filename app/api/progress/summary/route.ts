import { NextResponse, type NextRequest } from "next/server";

import { getUserContext } from "@/lib/auth/session";
import { getProgressSummary } from "@/lib/progress/service";

export const dynamic = "force-dynamic";

/**
 * GET /api/progress/summary?days=28
 * Weight trend + per-day intake history + adherence vs the active goal.
 */
export async function GET(req: NextRequest) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const daysParam = req.nextUrl.searchParams.get("days");
  let days = 28;
  if (daysParam) {
    const n = Number(daysParam);
    if (!Number.isFinite(n) || n < 7 || n > 90) {
      return NextResponse.json({ error: "days must be between 7 and 90" }, { status: 400 });
    }
    days = Math.round(n);
  }

  try {
    const summary = await getProgressSummary(ctx.supabase, ctx.userId, ctx.timeZone, days);
    return NextResponse.json(summary);
  } catch (err) {
    console.error("[api/progress/summary]", err);
    return NextResponse.json({ error: "Could not load progress." }, { status: 500 });
  }
}
