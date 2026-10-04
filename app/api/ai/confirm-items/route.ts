import { NextResponse, type NextRequest } from "next/server";

import { getUserContext } from "@/lib/auth/session";
import { confirmItemsRequestSchema } from "@/lib/ai/schemas";
import { recordAiCorrection } from "@/lib/ai/usage";
import { createCustomFood } from "@/lib/foods/repository";
import { createLog } from "@/lib/logging/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import type { ConfirmItemsResponse } from "@/types/ai";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/confirm-items
 *
 * Commits user-confirmed photo items to the diary. No LLM call happens here:
 * matched items log straight through the deterministic engine, and unmatched
 * items are first materialized as private `ai`-source custom foods from the
 * per-100 g estimate the user explicitly confirmed (flagged unverified).
 * Quantity edits made before confirming are stored as AI corrections
 * (personal-food-model learning signal, spec §5).
 */
export async function POST(req: NextRequest) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });

  const rl = rateLimit(`ai-confirm:${ctx.userId}`, { limit: 20, windowMs: 600_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${rl.retryAfterSec}s.`, code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body.", code: "BAD_REQUEST" }, { status: 400 });
  }

  const parsed = confirmItemsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request.", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }
  const { analysisId, items } = parsed.data;

  const results: ConfirmItemsResponse["results"] = [];
  let loggedCount = 0;
  let admin: ReturnType<typeof createAdminClient> | null = null;
  let adminError: string | null = null;

  for (const [index, item] of items.entries()) {
    try {
      let foodId = item.foodId ?? null;

      if (!foodId) {
        if (!item.nutritionPer100g) {
          results.push({
            index,
            ok: false,
            error: `"${item.candidate}" has no database match and no AI nutrition estimate — edit it manually from the Food screen instead.`,
          });
          continue;
        }
        // Lazily create the service-role client (only needed for AI fallbacks).
        if (!admin && !adminError) {
          try {
            admin = createAdminClient();
          } catch {
            adminError = "Server is missing SUPABASE_SERVICE_ROLE_KEY; AI-estimated foods cannot be saved.";
          }
        }
        if (!admin) {
          results.push({ index, ok: false, error: adminError ?? "Cannot save AI-estimated food." });
          continue;
        }

        const p = item.nutritionPer100g;
        const row = await createCustomFood(admin, ctx.userId, {
          name: item.candidate,
          calories: p.calories,
          protein_g: p.protein_g,
          carbs_g: p.carbs_g,
          fat_g: p.fat_g,
          serving_size: 100,
          serving_unit: "g",
          source: "ai",
          verification_status: "unverified",
          metadata_extra: {
            ai_estimated: true,
            ...(analysisId ? { analysis_id: analysisId } : {}),
          },
        });
        if (!row) {
          results.push({ index, ok: false, error: `Could not save "${item.candidate}".` });
          continue;
        }
        foodId = row.id;
      }

      const outcome = await createLog(
        ctx.supabase,
        ctx.userId,
        {
          foodId,
          quantity: item.quantity,
          unit: item.unit,
          mealType: item.mealType,
          source: "photo_ai",
          confidence: item.confidence ?? null,
          aiAnalysisId: analysisId,
          aiMetadata: {
            candidate: item.candidate,
            basis: item.foodId ? "database" : "ai_estimate",
            ...(item.uncertaintyFactors?.length ? { uncertainty_factors: item.uncertaintyFactors } : {}),
            ...(item.originalQuantity != null ? { original_quantity: item.originalQuantity } : {}),
          },
        },
        { timeZone: ctx.timeZone },
      );

      if (!outcome.ok) {
        results.push({ index, ok: false, error: outcome.message });
        continue;
      }

      // Learning signal: user edited the AI's portion before confirming.
      if (
        item.originalQuantity != null &&
        Math.abs(item.quantity - item.originalQuantity) / item.originalQuantity > 0.01
      ) {
        await recordAiCorrection(ctx.supabase, ctx.userId, {
          analysisId: analysisId ?? null,
          fieldName: "quantity",
          originalValue: { quantity: item.originalQuantity, unit: item.unit, candidate: item.candidate },
          correctedValue: { quantity: item.quantity, unit: item.unit },
        }).catch(() => {});
      }

      results.push({ index, ok: true, logId: outcome.log.id });
      loggedCount += 1;
    } catch (err) {
      console.error("[api/ai/confirm-items] item failed:", err);
      results.push({ index, ok: false, error: "Unexpected error saving this item." });
    }
  }

  return NextResponse.json({ results, loggedCount } satisfies ConfirmItemsResponse);
}
