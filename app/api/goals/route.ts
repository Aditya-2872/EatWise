import { NextResponse, type NextRequest } from "next/server";

import { getUserContext } from "@/lib/auth/session";
import { getActiveGoal, updateGoal } from "@/lib/goals/service";
import { rateLimit } from "@/lib/rate-limit";
import { updateGoalSchema } from "@/lib/validation/goals";

export const dynamic = "force-dynamic";

/** GET /api/goals — the user's current active goal + targets. */
export async function GET() {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const goal = await getActiveGoal(ctx.supabase, ctx.userId);
    return NextResponse.json({ goal });
  } catch (err) {
    console.error("[api/goals GET]", err);
    return NextResponse.json({ error: "Could not load your goal." }, { status: 500 });
  }
}

/** PATCH /api/goals — replace the active goal; targets recomputed server-side. */
export async function PATCH(req: NextRequest) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(`goal-update:${ctx.userId}`, { limit: 20, windowMs: 60_000 });
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

  const parsed = updateGoalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid goal payload." },
      { status: 400 },
    );
  }
  const v = parsed.data;

  try {
    const result = await updateGoal(ctx.supabase, ctx.userId, {
      goalType: v.goalType,
      ...(v.targetWeightKg != null ? { targetWeightKg: v.targetWeightKg } : {}),
      ...(v.targetRatePerWeek != null ? { targetRatePerWeek: v.targetRatePerWeek } : {}),
      ...(v.activityLevel ? { activityLevel: v.activityLevel } : {}),
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const goal = await getActiveGoal(ctx.supabase, ctx.userId);
    return NextResponse.json({ goal, targets: result.targets });
  } catch (err) {
    console.error("[api/goals PATCH]", err);
    return NextResponse.json({ error: "Could not update your goal." }, { status: 500 });
  }
}
