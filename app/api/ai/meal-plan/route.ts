import { NextResponse, type NextRequest } from "next/server";

import { getUserContext } from "@/lib/auth/session";
import { buildMealPlanContext, defaultMealSlots, loadDayContext } from "@/lib/ai/context";
import { requestMealPlan } from "@/lib/ai/gateway";
import { mealPlanRequestSchema } from "@/lib/ai/schemas";
import { aiErrorBody } from "@/lib/ai/types";
import { recordAiAnalysis } from "@/lib/ai/usage";
import { rateLimit } from "@/lib/rate-limit";
import type { MealPlanResponse } from "@/types/ai";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/meal-plan (spec §25 — Next-Meal Intelligence, §5)
 *
 * Body: { mealTypes? }. Defaults to the remaining meal slots of the user's
 * day (deterministic from local hour). Context: remaining calorie/macro
 * budget, goal, frequent foods. Estimates in the plan are illustrative —
 * logging any of them recomputes exact values through the engine.
 */
export async function POST(req: NextRequest) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });

  const daily = rateLimit(`ai-mealplan-d:${ctx.userId}`, { limit: 8, windowMs: 86_400_000 });
  if (!daily.ok) {
    return NextResponse.json(
      { error: "Daily meal-plan limit reached (AI free tier). Try again tomorrow.", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(daily.retryAfterSec) } },
    );
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {}; // empty body is valid (defaults apply)
  }

  const parsed = mealPlanRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request.", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  try {
    const dayCtx = await loadDayContext(ctx.supabase, ctx.userId, ctx.timeZone);
    const mealTypes = parsed.data.mealTypes ?? defaultMealSlots(dayCtx.hour);
    const contextJson = await buildMealPlanContext(ctx.supabase, ctx.userId, dayCtx);

    const result = await requestMealPlan(mealTypes, contextJson);

    const analysisId = await recordAiAnalysis(ctx.supabase, ctx.userId, {
      type: "meal_plan",
      provider: result.meta.provider,
      model: result.meta.model,
      requestMetadata: { mealTypes, contextBytes: contextJson.length },
      responseJson: result.data as unknown as Record<string, unknown>,
      status: "succeeded",
      tokensInput: result.meta.tokensInput,
      tokensOutput: result.meta.tokensOutput,
      latencyMs: result.meta.latencyMs,
    });

    const payload: MealPlanResponse = {
      analysisId,
      plan: result.data,
      meta: {
        provider: result.meta.provider,
        model: result.meta.model,
        latencyMs: result.meta.latencyMs,
      },
    };
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[api/ai/meal-plan]", err);
    const { status, body: errBody } = aiErrorBody(err);
    return NextResponse.json(errBody, { status });
  }
}
