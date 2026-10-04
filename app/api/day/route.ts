import { NextResponse, type NextRequest } from "next/server";

import { getUserContext } from "@/lib/auth/session";
import { getDailySummary } from "@/lib/logging/service";

export const dynamic = "force-dynamic";

/**
 * GET /api/day[?date=YYYY-MM-DD]
 * Daily intake, macro split, per-meal totals, active targets and profile flag.
 * Defaults to the user's local today (timezone from their profile).
 */
export async function GET(req: NextRequest) {
  const ctx = await getUserContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dateParam = req.nextUrl.searchParams.get("date");
  let date: string | undefined;
  if (dateParam) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
    }
    date = dateParam;
  }

  try {
    const summary = await getDailySummary(ctx.supabase, ctx.userId, date);
    return NextResponse.json(summary);
  } catch (err) {
    console.error("[api/day]", err);
    return NextResponse.json(
      { error: "Could not load your day. Please try again." },
      { status: 500 },
    );
  }
}
