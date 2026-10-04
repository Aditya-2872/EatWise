import { NextResponse, type NextRequest } from "next/server";

import { getUserContext } from "@/lib/auth/session";
import { deleteLog, editLog } from "@/lib/logging/service";
import { rateLimit } from "@/lib/rate-limit";
import { editLogSchema } from "@/lib/validation/logging";

export const dynamic = "force-dynamic";

/** PATCH /api/logs/:id — edit quantity/unit/meal/time; snapshot recomputed. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(`log-edit:${ctx.userId}`, { limit: 60, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = editLogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid edit payload." },
      { status: 400 },
    );
  }
  const v = parsed.data;

  try {
    const outcome = await editLog(
      ctx.supabase,
      ctx.userId,
      id,
      {
        ...(v.quantity != null ? { quantity: v.quantity } : {}),
        ...(v.unit ? { unit: v.unit } : {}),
        ...(v.mealType ? { mealType: v.mealType } : {}),
        ...(v.loggedAt ? { loggedAt: v.loggedAt } : {}),
      },
      { timeZone: ctx.timeZone },
    );
    if (!outcome.ok) {
      const status = outcome.code === "FOOD_NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: outcome.message, code: outcome.code }, { status });
    }
    return NextResponse.json({ log: outcome.log, day: outcome.day });
  } catch (err) {
    console.error("[api/logs PATCH]", err);
    return NextResponse.json({ error: "Could not update the log." }, { status: 500 });
  }
}

/** DELETE /api/logs/:id */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const result = await deleteLog(ctx.supabase, ctx.userId, id);
    if (!result.ok) {
      return NextResponse.json({ error: result.message, code: result.code }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/logs DELETE]", err);
    return NextResponse.json({ error: "Could not delete the log." }, { status: 500 });
  }
}
