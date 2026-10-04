import { NextResponse, type NextRequest } from "next/server";

import { getUserContext } from "@/lib/auth/session";
import { analyzeFoodImage } from "@/lib/ai/gateway";
import { mapAiItems, overallConfidence } from "@/lib/ai/food-mapping";
import { routeModel } from "@/lib/ai/routing";
import { analyzeImageRequestSchema } from "@/lib/ai/schemas";
import { aiErrorBody, AiConfigError } from "@/lib/ai/types";
import { recordAiAnalysis } from "@/lib/ai/usage";
import { rateLimit } from "@/lib/rate-limit";
import type { AnalyzeFoodImageResponse } from "@/types/ai";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/analyze-food-image (spec §14/§25)
 *
 * Body: { imageBase64, mimeType, mealType?, hints? } — the client compresses
 * the photo before upload. The vision model identifies foods + portions;
 * mapAiItems() then deterministically matches database foods and lets the
 * nutrition engine compute every number. Responses are Zod-validated.
 */
export async function POST(req: NextRequest) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });

  const hourly = rateLimit(`ai-image-h:${ctx.userId}`, { limit: 4, windowMs: 3_600_000 });
  if (!hourly.ok) {
    return NextResponse.json(
      { error: `Too many photo analyses. Try again in ${hourly.retryAfterSec}s.`, code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(hourly.retryAfterSec) } },
    );
  }
  const daily = rateLimit(`ai-image-d:${ctx.userId}`, { limit: 10, windowMs: 86_400_000 });
  if (!daily.ok) {
    return NextResponse.json(
      { error: "Daily photo-analysis limit reached (AI free tier). Try again tomorrow.", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(daily.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body.", code: "BAD_REQUEST" }, { status: 400 });
  }

  const parsed = analyzeImageRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request.", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }
  const { imageBase64, mimeType, mealType, hints } = parsed.data;

  try {
    const result = await analyzeFoodImage({ base64: imageBase64, mimeType }, { mealType, hints });
    const items = await mapAiItems(ctx.supabase, ctx.userId, result.data.items);
    const overall = overallConfidence(items);

    const analysisId = await recordAiAnalysis(ctx.supabase, ctx.userId, {
      type: "food_image",
      provider: result.meta.provider,
      model: result.meta.model,
      requestMetadata: {
        mimeType,
        approxBytes: Math.round(imageBase64.length * 0.75),
        mealType: mealType ?? null,
        hasHints: Boolean(hints),
      },
      responseJson: result.data as unknown as Record<string, unknown>,
      confidence: overall,
      status: "succeeded",
      tokensInput: result.meta.tokensInput,
      tokensOutput: result.meta.tokensOutput,
      latencyMs: result.meta.latencyMs,
    });

    const payload: AnalyzeFoodImageResponse = {
      analysisId,
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
    console.error("[api/ai/analyze-food-image]", err);
    if (!(err instanceof AiConfigError)) {
      await recordAiAnalysis(ctx.supabase, ctx.userId, {
        type: "food_image",
        provider: "gemini",
        model: safeModel("food_image"),
        requestMetadata: { mimeType },
        status: "failed",
        errorCode: err instanceof Error ? err.name : "UNKNOWN",
      }).catch(() => {});
    }
    const { status, body: errBody } = aiErrorBody(err);
    return NextResponse.json(errBody, { status });
  }
}

function safeModel(task: "food_image" | "clarification" | "guidance" | "meal_plan"): string {
  try {
    return routeModel(task);
  } catch {
    return "unknown";
  }
}
