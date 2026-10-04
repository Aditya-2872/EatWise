"use server";

import { getUserContext } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createLog,
  deleteLog,
  editLog,
  type DayIntake,
  type FoodLogRow,
} from "@/lib/logging/service";
import { createCustomFood, recordUsage } from "@/lib/foods/repository";
import {
  createLogSchema,
  editLogSchema,
} from "@/lib/validation/logging";
import { z } from "zod";

export type LogActionResult =
  | { ok: true; log: FoodLogRow; day: DayIntake }
  | { ok: false; error: string };

async function requireUser() {
  const ctx = await getUserContext();
  if (!ctx) return null;
  return ctx;
}

export async function createLogAction(input: unknown): Promise<LogActionResult> {
  const ctx = await requireUser();
  if (!ctx) return { ok: false, error: "You must be signed in." };

  const parsed = createLogSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the details." };
  }

  const outcome = await createLog(
    ctx.supabase,
    ctx.userId,
    {
      foodId: parsed.data.foodId,
      quantity: parsed.data.quantity,
      unit: parsed.data.unit,
      ...(parsed.data.mealType ? { mealType: parsed.data.mealType } : {}),
      ...(parsed.data.loggedAt ? { loggedAt: parsed.data.loggedAt } : {}),
      ...(parsed.data.source ? { source: parsed.data.source } : {}),
      ...(parsed.data.confidence !== undefined && parsed.data.confidence !== null
        ? { confidence: parsed.data.confidence }
        : {}),
      ...(parsed.data.aiAnalysisId ? { aiAnalysisId: parsed.data.aiAnalysisId } : {}),
      ...(parsed.data.aiMetadata ? { aiMetadata: parsed.data.aiMetadata } : {}),
    },
    { timeZone: ctx.timeZone },
  );

  if (!outcome.ok) return { ok: false, error: outcome.message };
  return { ok: true, log: outcome.log, day: outcome.day };
}

export async function editLogAction(
  logId: string,
  patch: unknown,
): Promise<LogActionResult> {
  const ctx = await requireUser();
  if (!ctx) return { ok: false, error: "You must be signed in." };

  const parsed = editLogSchema.safeParse(patch);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the details." };
  }

  const outcome = await editLog(
    ctx.supabase,
    ctx.userId,
    logId,
    {
      ...(parsed.data.quantity != null ? { quantity: parsed.data.quantity } : {}),
      ...(parsed.data.unit ? { unit: parsed.data.unit } : {}),
      ...(parsed.data.mealType ? { mealType: parsed.data.mealType } : {}),
      ...(parsed.data.loggedAt ? { loggedAt: parsed.data.loggedAt } : {}),
    },
    { timeZone: ctx.timeZone },
  );

  if (!outcome.ok) return { ok: false, error: outcome.message };
  return { ok: true, log: outcome.log, day: outcome.day };
}

export async function deleteLogAction(
  logId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireUser();
  if (!ctx) return { ok: false, error: "You must be signed in." };

  const result = await deleteLog(ctx.supabase, ctx.userId, logId);
  if (!result.ok) return { ok: false, error: result.message };
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Custom (user-entered) foods                                         */
/* ------------------------------------------------------------------ */

const customFoodSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(120),
  brand: z.string().trim().max(120).nullish(),
  /** Nutrition per serving as entered; servingSize/servingUnit describe it. */
  servingSize: z.number().positive().max(10000).default(100),
  servingUnit: z.string().trim().min(1).max(10).default("g"),
  calories: z.number().min(0).max(20000),
  proteinG: z.number().min(0).max(2000),
  carbsG: z.number().min(0).max(2000),
  fatG: z.number().min(0).max(2000),
  fiberG: z.number().min(0).max(500).nullish(),
  sugarG: z.number().min(0).max(2000).nullish(),
  sodiumMg: z.number().min(0).max(50000).nullish(),
  category: z.string().trim().max(60).nullish(),
});

export async function createCustomFoodAction(
  input: unknown,
): Promise<{ ok: true; foodId: string } | { ok: false; error: string }> {
  const ctx = await requireUser();
  if (!ctx) return { ok: false, error: "You must be signed in." };

  const parsed = customFoodSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the details." };
  }
  const v = parsed.data;

  // Custom foods are written to the shared table with the service role and
  // scoped to the owner via metadata.owner_user_id (+ search RPC filter).
  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    return {
      ok: false,
      error: `Server is missing SUPABASE_SERVICE_ROLE_KEY (${err instanceof Error ? err.message : "config"})`,
    };
  }

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
  if (!row) return { ok: false, error: "Could not save the food. Please try again." };

  // Add to personal memory so it appears in recent foods.
  await recordUsage(ctx.supabase, ctx.userId, row.id, null).catch(() => {});

  return { ok: true, foodId: row.id };
}
