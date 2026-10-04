import { NextResponse, type NextRequest } from "next/server";

import { getUserContext } from "@/lib/auth/session";
import { clarifyFoodAnalysis } from "@/lib/ai/gateway";
import { mapAiItems, overallConfidence } from "@/lib/ai/food-mapping";
import { clarifyRequestSchema } from "@/lib/ai/schemas";
import { aiErrorBody } from "@/lib/ai/types";
import { recordAiAnalysis } from "@/lib/ai/usage";
import { rateLimit } from "@/lib/rate-limit";
import type { AnalyzeFoodImageResponse } from "@/types/ai";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/clarify (spec §14 Smart Clarification)
 *
 * Body: { analysisId?, analysis, question, answer } — the client round-trips
 * the raw analysis it received. The language model revises quantities /
 * confidence given the answer; mapping + nutrition stay deterministic.
 */
export async function POST(req: NextRequest) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });

  const rl = rateLimit(`ai-clarify-d:${ctx.userId}`, { limit: 12, windowMs: 86_400_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Daily clarification limit reached. Try again tomorrow.", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body.", code: "BAD_REQUEST" }, { status: 400 });
  }

  const parsed = clarifyRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request.", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }
  const { analysisId, analysis, question, answer } = parsed.data;

  try {
    const result = await clarifyFoodAnalysis(analysis, question, answer);
    const items = await mapAiItems(ctx.supabase, ctx.userId, result.data.items);
    const overall = overallConfidence(items);

    const newAnalysisId = await recordAiAnalysis(ctx.supabase, ctx.userId, {
      type: "clarification",
      provider: result.meta.provider,
      model: result.meta.model,
      requestMetadata: { parentAnalysisId: analysisId ?? null, question, answer },
      responseJson: result.data as unknown as Record<string, unknown>,
      confidence: overall,
      status: "succeeded",
      tokensInput: result.meta.tokensInput,
      tokensOutput: result.meta.tokensOutput,
      latencyMs: result.meta.latencyMs,
    });

    const payload: AnalyzeFoodImageResponse = {
      analysisId: newAnalysisId,
      needsClarification: result.data.needs_clarification && result.data.clarification != null,
      clarification: result.data.clarification
        ? {
            question: result.data.clarification.question,
            itemIndex: result.data.clarification.item_index ?? null,
          }
        : null,
      rawAnalysis: result.data,
      items,
      overallConfidence: overall,
      meta: {
        provider: result.meta.provider,
        model: result.meta.model,
        latencyMs: result.meta.latencyMs,
      },
    };
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[api/ai/clarify]", err);
    const { status, body: errBody } = aiErrorBody(err);
    return NextResponse.json(errBody, { status });
  }
}
