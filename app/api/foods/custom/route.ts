import { NextResponse, type NextRequest } from "next/server";

import { getUserContext } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createCustomFood, listCustomFoods, recordUsage } from "@/lib/foods/repository";
import { rateLimit } from "@/lib/rate-limit";
import { customFoodApiSchema } from "@/lib/validation/goals";

export const dynamic = "force-dynamic";

/**
 * GET /api/foods/custom — the caller's own custom/AI foods
 * (source user|ai, metadata.owner_user_id = caller).
 */
export async function GET() {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const foods = await listCustomFoods(ctx.supabase, ctx.userId);
  return NextResponse.json({ foods });
}

/**
 * POST /api/foods/custom — create a user-entered food. Written with the
 * service role and scoped to the owner via metadata.owner_user_id.
 */
export async function POST(req: NextRequest) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(`food-custom:${ctx.userId}`, { limit: 30, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many custom foods. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = customFoodApiSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid food payload." },
      { status: 400 },
    );
  }
  const v = parsed.data;

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    return NextResponse.json(
      {
        error: `Server is missing SUPABASE_SERVICE_ROLE_KEY (${err instanceof Error ? err.message : "config"})`,
      },
      { status: 500 },
    );
  }

  try {
    const row = await createCustomFood(admin, ctx.userId, {
      name: v.name,
      ...(v.brand ? { brand: v.brand } : {}),
      calories: v.calories,
      protein_g: v.proteinG,
      carbs_g: v.carbsG,
      fat_g: v.fatG,
      ...(v.fiberG != null ? { fiber_g: v.fiberG } : {}),
      ...(v.sugarG != null ? { sugar_g: v.sugarG } : {}),
      ...(v.sodiumMg != null ? { sodium_mg: v.sodiumMg } : {}),
      serving_size: v.servingSize,
      serving_unit: v.servingUnit,
      ...(v.category ? { category: v.category } : {}),
      source: "user",
      verification_status: "user_reported",
    });
    if (!row) {
      return NextResponse.json({ error: "Could not save the food." }, { status: 500 });
    }
    await recordUsage(ctx.supabase, ctx.userId, row.id, null).catch(() => {});
    return NextResponse.json({ food: row }, { status: 201 });
  } catch (err) {
    console.error("[api/foods/custom]", err);
    return NextResponse.json({ error: "Could not save the food." }, { status: 500 });
  }
}
