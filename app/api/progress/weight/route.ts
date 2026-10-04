import { NextResponse, type NextRequest } from "next/server";

import { getUserContext } from "@/lib/auth/session";
import { addWeightEntry, listWeightEntries } from "@/lib/progress/service";
import { rateLimit } from "@/lib/rate-limit";
import { weightEntrySchema } from "@/lib/validation/goals";

export const dynamic = "force-dynamic";

/** GET /api/progress/weight?days=90 — weight entries (ascending). */
export async function GET(req: NextRequest) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const daysParam = req.nextUrl.searchParams.get("days");
  let days = 90;
  if (daysParam) {
    const n = Number(daysParam);
    if (!Number.isFinite(n) || n < 1 || n > 3650) {
      return NextResponse.json({ error: "days out of range" }, { status: 400 });
    }
    days = Math.round(n);
  }

  try {
    const entries = await listWeightEntries(ctx.supabase, ctx.userId, days);
    return NextResponse.json({ entries });
  } catch (err) {
    console.error("[api/progress/weight GET]", err);
    return NextResponse.json({ error: "Could not load weight history." }, { status: 500 });
  }
}

/** POST /api/progress/weight — record a weight entry. */
export async function POST(req: NextRequest) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(`weight-add:${ctx.userId}`, { limit: 30, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many updates. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = weightEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid weight payload." },
      { status: 400 },
    );
  }
  const v = parsed.data;

  try {
    const entry = await addWeightEntry(ctx.supabase, ctx.userId, {
      weightKg: v.weightKg,
      ...(v.recordedAt ? { recordedAt: v.recordedAt } : {}),
      ...(v.notes != null ? { notes: v.notes } : {}),
      ...(v.source ? { source: v.source } : {}),
    });
    if (!entry) {
      return NextResponse.json({ error: "Could not save the weight entry." }, { status: 500 });
    }
    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    console.error("[api/progress/weight POST]", err);
    return NextResponse.json({ error: "Could not save the weight entry." }, { status: 500 });
  }
}
