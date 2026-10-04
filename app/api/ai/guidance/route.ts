import { NextResponse, type NextRequest } from "next/server";

import { getUserContext } from "@/lib/auth/session";
import { buildGuidanceContext, loadDayContext } from "@/lib/ai/context";
import { requestGuidance } from "@/lib/ai/gateway";
import { guidanceRequestSchema } from "@/lib/ai/schemas";
import { aiErrorBody } from "@/lib/ai/types";
import { recordAiAnalysis } from "@/lib/ai/usage";
import { rateLimit } from "@/lib/rate-limit";
import type { GuidanceResponse } from "@/types/ai";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/guidance (spec §19/§25)
 *
 * Body: { question }. The server builds a deterministic context (goal,
 * targets, today's intake, 28-day averages, weight trend) from the nutrition
 * engine and passes it to the language model; the model explains/recommends
 * but never computes the authoritative numbers.
 */
export async function POST(req: NextRequest) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });

  const hourly = rateLimit(`ai-guidance-h:${ctx.userId}`, { limit: 6, windowMs: 3_600_000 });
  if (!hourly.ok) {
    return NextResponse.json(
      { error: `Too many coach questions. Try again in ${hourly.retryAfterSec}s.`, code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(hourly.retryAfterSec) } },
    );
  }
  const daily = rateLimit(`ai-guidance-d:${ctx.userId}`, { limit: 15, windowMs: 86_400_000 });
  if (!daily.ok) {
    return NextResponse.json(
      { error: "Daily coach limit reached (AI free tier). Try again tomorrow.", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(daily.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body.", code: "BAD_REQUEST" }, { status: 400 });
  }

  const parsed = guidanceRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request.", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  try {
    const dayCtx = await loadDayContext(ctx.supabase, ctx.userId, ctx.timeZone);
    const contextJson = buildGuidanceContext(dayCtx);

    const result = await requestGuidance(parsed.data.question, contextJson);

    const analysisId = await recordAiAnalysis(ctx.supabase, ctx.userId, {
      type: "guidance",
      provider: result.meta.provider,
      model: result.meta.model,
      requestMetadata: { question: parsed.data.question, contextBytes: contextJson.length },
      responseJson: result.data as unknown as Record<string, unknown>,
      status: "succeeded",
      tokensInput: result.meta.tokensInput,
      tokensOutput: result.meta.tokensOutput,
      latencyMs: result.meta.latencyMs,
    });

    const payload: GuidanceResponse = {
      analysisId,
      guidance: result.data,
      meta: {
        provider: result.meta.provider,
        model: result.meta.model,
        latencyMs: result.meta.latencyMs,
      },
    };
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[api/ai/guidance]", err);
    const { status, body: errBody } = aiErrorBody(err);
    return NextResponse.json(errBody, { status });
  }
}
