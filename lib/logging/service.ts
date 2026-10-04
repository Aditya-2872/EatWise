/**
 * Deterministic food-logging service (spec §17, §18).
 *
 * ALL arithmetic here is typed server-side code — never an LLM. Snapshots are
 * frozen onto each log so history never shifts when master data changes.
 *
 * Callers pass an explicit Supabase client:
 * - user-scoped client for reads/writes guarded by RLS,
 * - the caller is responsible for authentication.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { FoodItemRow } from "@/types/food";
import type {
  LogSource,
  MealType,
  NutritionSnapshot,
} from "@/types/nutrition";
import {
  emptySnapshot,
  macroCalorieSplit,
  scaleSnapshot,
  sumSnapshots,
} from "@/lib/nutrition/calculations";
import {
  MASS_TO_GRAMS,
  normalizeUnit,
  unitKind,
} from "@/lib/nutrition/units";
import {
  computeSnapshot,
  resolveGrams,
  type GramsResolution,
  type LogErrorCode,
  type LogFailure,
} from "@/lib/nutrition/resolve";
import {
  inferMealType,
  localDayRangeUtc,
  localHour,
  todayLocalDateStr,
} from "@/lib/nutrition/daily";
import {
  canAccessFood,
  getFoodById,
  getFoodsByIds,
  recordUsage,
} from "@/lib/foods/repository";

// The pure quantity→snapshot math lives in lib/nutrition/resolve.ts so the
// client preview and the server persistence share ONE implementation.
// Re-exported here because existing callers import it from this module.
export { computeSnapshot, resolveGrams };
export type { GramsResolution, LogErrorCode, LogFailure };

export interface FoodLogRow {
  id: string;
  user_id: string;
  food_id: string | null;
  meal_id: string | null;
  quantity: number;
  unit: string;
  meal_type: MealType;
  logged_at: string;
  source: LogSource;
  confidence: number | null;
  nutrition_snapshot: NutritionSnapshot;
  ai_metadata: Record<string, unknown> | null;
  /** Joined display info (not persisted). */
  food_name?: string | null;
  food_brand?: string | null;
}

export interface CreateLogInput {
  foodId: string;
  quantity: number;
  unit: string;
  mealType?: MealType;
  loggedAt?: string; // ISO; default now
  source?: LogSource; // default 'manual'
  confidence?: number | null;
  aiAnalysisId?: string | null;
  aiMetadata?: Record<string, unknown> | null;
}

export interface DayIntake {
  date: string; // YYYY-MM-DD (local)
  timeZone: string;
  logs: FoodLogRow[];
  total: NutritionSnapshot;
  byMeal: Record<MealType, NutritionSnapshot>;
  split: ReturnType<typeof macroCalorieSplit>;
}

export interface LogSuccess {
  ok: true;
  log: FoodLogRow;
  day: DayIntake;
}

export type LogOutcome = LogSuccess | LogFailure;

export interface DaySummary {
  intake: DayIntake;
  targets: {
    goalType: string;
    calorieTarget: number;
    proteinTargetG: number;
    carbTargetG: number;
    fatTargetG: number;
  } | null;
  profile: {
    displayName: string | null;
    sex: string | null;
    heightCm: number | null;
    currentWeightKg: number | null;
    onboardingCompleted: boolean;
  } | null;
}

/* ------------------------------------------------------------------ */
/* Row mapping                                                         */
/* ------------------------------------------------------------------ */

type Raw = Record<string, unknown>;

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function snapshotFromJson(v: unknown): NutritionSnapshot {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    calories: num(o.calories),
    proteinG: num(o.proteinG),
    carbsG: num(o.carbsG),
    fatG: num(o.fatG),
    fiberG: num(o.fiberG),
    sugarG: num(o.sugarG),
    sodiumMg: num(o.sodiumMg),
    ...(o.micronutrients && typeof o.micronutrients === "object"
      ? {
          micronutrients: Object.fromEntries(
            Object.entries(o.micronutrients as Record<string, unknown>).map(([k, x]) => [
              k,
              num(x),
            ]),
          ),
        }
      : {}),
  };
}

export function mapLogRow(raw: Raw): FoodLogRow {
  return {
    id: String(raw.id),
    user_id: String(raw.user_id),
    food_id: raw.food_id ? String(raw.food_id) : null,
    meal_id: raw.meal_id ? String(raw.meal_id) : null,
    quantity: num(raw.quantity),
    unit: String(raw.unit ?? "g"),
    meal_type: String(raw.meal_type ?? "snack") as MealType,
    logged_at: String(raw.logged_at ?? new Date().toISOString()),
    source: String(raw.source ?? "manual") as LogSource,
    confidence: raw.confidence == null ? null : num(raw.confidence),
    nutrition_snapshot: snapshotFromJson(raw.nutrition_snapshot),
    ai_metadata:
      raw.ai_metadata && typeof raw.ai_metadata === "object"
        ? (raw.ai_metadata as Record<string, unknown>)
        : null,
  };
}

/* ------------------------------------------------------------------ */
/* Create / edit / delete                                              */
/* ------------------------------------------------------------------ */

export async function createLog(
  supabase: SupabaseClient,
  userId: string,
  input: CreateLogInput,
  ctx: { timeZone: string },
): Promise<LogOutcome> {
  const row = await getFoodById(supabase, input.foodId);
  // Private foods of other users are reported as "not found" (no existence leak).
  if (!row || !canAccessFood(row, userId)) {
    return { ok: false, code: "FOOD_NOT_FOUND", message: "That food could not be found." };
  }

  const computed = computeSnapshot(row, input.quantity, input.unit);
  if ("error" in computed) return computed.error;

  const now = new Date();
  const loggedAt = input.loggedAt && !Number.isNaN(Date.parse(input.loggedAt))
    ? new Date(input.loggedAt)
    : now;
  const mealType: MealType =
    input.mealType ?? inferMealType(localHour(ctx.timeZone, loggedAt));

  const aiMetadata: Record<string, unknown> = {
    ...(input.aiMetadata ?? {}),
    grams: Math.round(computed.resolution.grams * 10) / 10,
    ...(computed.resolution.basis ? { conversion_basis: computed.resolution.basis } : {}),
  };

  const { data, error } = await supabase
    .from("food_logs")
    .insert({
      user_id: userId,
      food_id: row.id,
      quantity: input.quantity,
      unit: normalizeUnit(input.unit),
      meal_type: mealType,
      logged_at: loggedAt.toISOString(),
      source: input.source ?? "manual",
      confidence: input.confidence ?? null,
      nutrition_snapshot: computed.snapshot,
      ai_metadata: aiMetadata,
      ...(input.aiAnalysisId ? { ai_analysis_id: input.aiAnalysisId } : {}),
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("[logging] insert failed:", error?.message);
    return { ok: false, code: "DB_ERROR", message: "Could not save the log. Please try again." };
  }

  const log = mapLogRow(data as Raw);
  log.food_name = row.name;
  log.food_brand = row.brand;

  // Personal food memory (spec §14): bump usage + remember usual quantity.
  await recordUsage(supabase, userId, row.id, {
    quantity: input.quantity,
    unit: normalizeUnit(input.unit),
  }).catch((err) => console.error("[logging] recordUsage failed:", err));

  const day = await getDayIntake(supabase, userId, ctx.timeZone, undefined, loggedAt);
  return { ok: true, log, day };
}

export interface EditLogInput {
  quantity?: number;
  unit?: string;
  mealType?: MealType;
  loggedAt?: string;
}

export async function editLog(
  supabase: SupabaseClient,
  userId: string,
  logId: string,
  patch: EditLogInput,
  ctx: { timeZone: string },
): Promise<LogOutcome> {
  const { data: existingRaw, error: selErr } = await supabase
    .from("food_logs")
    .select("*")
    .eq("id", logId)
    .eq("user_id", userId)
    .maybeSingle();
  if (selErr || !existingRaw) {
    return { ok: false, code: "FOOD_NOT_FOUND", message: "Log entry not found." };
  }
  const existing = mapLogRow(existingRaw as Raw);

  const update: Record<string, unknown> = {};
  let snapshot = existing.nutrition_snapshot;

  if (patch.quantity != null || patch.unit != null) {
    const quantity = patch.quantity ?? existing.quantity;
    const unit = patch.unit ?? existing.unit;

    if (existing.food_id) {
      const row = await getFoodById(supabase, existing.food_id);
      if (!row || !canAccessFood(row, userId)) {
        return { ok: false, code: "FOOD_NOT_FOUND", message: "The food for this log is gone." };
      }
      const computed = computeSnapshot(row, quantity, unit);
      if ("error" in computed) return computed.error;
      snapshot = computed.snapshot;
      update.ai_metadata = {
        ...(existing.ai_metadata ?? {}),
        grams: Math.round(computed.resolution.grams * 10) / 10,
        ...(computed.resolution.basis ? { conversion_basis: computed.resolution.basis } : {}),
      };
    } else {
      // AI/manual log without a master food: scale the frozen snapshot by the
      // gram ratio (only possible when both old and new units are mass).
      const oldGrams = Number((existing.ai_metadata as Record<string, unknown> | null)?.grams);
      const oldUnit = normalizeUnit(existing.unit);
      const newUnit = normalizeUnit(unit);
      if (
        !Number.isFinite(oldGrams) || oldGrams <= 0 ||
        unitKind(oldUnit) !== "mass" || unitKind(newUnit) !== "mass"
      ) {
        return {
          ok: false,
          code: "UNSUPPORTED_EDIT",
          message: "Quantity for this entry can only be edited in grams.",
        };
      }
      const newGrams = quantity * MASS_TO_GRAMS[newUnit];
      snapshot = scaleSnapshot(existing.nutrition_snapshot, newGrams / oldGrams);
      update.ai_metadata = { ...(existing.ai_metadata ?? {}), grams: Math.round(newGrams * 10) / 10 };
    }
    update.quantity = quantity;
    update.unit = normalizeUnit(unit);
    update.nutrition_snapshot = snapshot;
  }

  if (patch.mealType) update.meal_type = patch.mealType;
  if (patch.loggedAt) {
    const d = new Date(patch.loggedAt);
    if (Number.isNaN(d.getTime())) {
      return { ok: false, code: "INVALID_QUANTITY", message: "Invalid date/time." };
    }
    update.logged_at = d.toISOString();
    if (!patch.mealType) update.meal_type = inferMealType(localHour(ctx.timeZone, d));
  }

  if (Object.keys(update).length === 0) {
    return { ok: false, code: "UNSUPPORTED_EDIT", message: "Nothing to update." };
  }

  const { data, error } = await supabase
    .from("food_logs")
    .update(update)
    .eq("id", logId)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error || !data) {
    console.error("[logging] update failed:", error?.message);
    return { ok: false, code: "DB_ERROR", message: "Could not update the log." };
  }

  const log = mapLogRow(data as Raw);
  const day = await getDayIntake(supabase, userId, ctx.timeZone, undefined, new Date(log.logged_at));
  return { ok: true, log, day };
}

export async function deleteLog(
  supabase: SupabaseClient,
  userId: string,
  logId: string,
): Promise<{ ok: true } | LogFailure> {
  const { error } = await supabase
    .from("food_logs")
    .delete()
    .eq("id", logId)
    .eq("user_id", userId);
  if (error) {
    console.error("[logging] delete failed:", error.message);
    return { ok: false, code: "DB_ERROR", message: "Could not delete the log." };
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Daily aggregation                                                   */
/* ------------------------------------------------------------------ */

export async function getDayIntake(
  supabase: SupabaseClient,
  userId: string,
  timeZone: string,
  localDate?: string,
  at?: Date,
): Promise<DayIntake> {
  const date = localDate ?? todayLocalDateStr(timeZone, at);
  const { startIso, endIso } = localDayRangeUtc(timeZone, date);

  const { data, error } = await supabase
    .from("food_logs")
    .select("*")
    .eq("user_id", userId)
    .gte("logged_at", startIso)
    .lt("logged_at", endIso)
    .order("logged_at", { ascending: true });
  if (error) {
    console.error("[logging] day query failed:", error.message);
  }

  const logs = ((data ?? []) as Raw[]).map(mapLogRow);

  // Resolve display names in one batch.
  const foodIds = logs.map((l) => l.food_id).filter((x): x is string => x != null);
  const foods = await getFoodsByIds(supabase, foodIds);
  for (const l of logs) {
    const f = l.food_id ? foods.get(l.food_id) : undefined;
    l.food_name =
      f?.name ??
      (typeof (l.ai_metadata as Record<string, unknown> | null)?.name === "string"
        ? ((l.ai_metadata as Record<string, unknown>).name as string)
        : null) ??
      "Unknown food";
    l.food_brand = f?.brand ?? null;
  }

  const byMeal: Record<MealType, NutritionSnapshot> = {
    breakfast: emptySnapshot(),
    lunch: emptySnapshot(),
    dinner: emptySnapshot(),
    snack: emptySnapshot(),
    custom: emptySnapshot(),
  };
  const perMeal: Record<MealType, NutritionSnapshot[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
    custom: [],
  };
  for (const l of logs) perMeal[l.meal_type].push(l.nutrition_snapshot);
  for (const meal of Object.keys(byMeal) as MealType[]) {
    byMeal[meal] = sumSnapshots(perMeal[meal]);
  }

  const total = sumSnapshots(logs.map((l) => l.nutrition_snapshot));

  return { date, timeZone, logs, total, byMeal, split: macroCalorieSplit(total) };
}

/** Dashboard payload: intake for a day (default today) + active targets + minimal profile. */
export async function getDailySummary(
  supabase: SupabaseClient,
  userId: string,
  localDate?: string,
): Promise<DaySummary> {
  const [{ data: profileRaw }, { data: goalRaw }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, sex, height_cm, current_weight_kg, timezone, onboarding_completed")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("user_goals")
      .select("goal_type, calorie_target, protein_target_g, carb_target_g, fat_target_g")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  const profile = profileRaw as Record<string, unknown> | null;
  const timeZone =
    (profile?.timezone as string | undefined) ??
    Intl.DateTimeFormat().resolvedOptions().timeZone ??
    "Asia/Kolkata";

  const intake = await getDayIntake(supabase, userId, timeZone, localDate);

  const targets = goalRaw
    ? {
        goalType: String(goalRaw.goal_type),
        calorieTarget: num(goalRaw.calorie_target),
        proteinTargetG: num(goalRaw.protein_target_g),
        carbTargetG: num(goalRaw.carb_target_g),
        fatTargetG: num(goalRaw.fat_target_g),
      }
    : null;

  return {
    intake,
    targets,
    profile: profile
      ? {
          displayName: (profile.display_name as string | null) ?? null,
          sex: (profile.sex as string | null) ?? null,
          heightCm: profile.height_cm == null ? null : num(profile.height_cm),
          currentWeightKg:
            profile.current_weight_kg == null ? null : num(profile.current_weight_kg),
          onboardingCompleted: Boolean(profile.onboarding_completed),
        }
      : null,
  };
}
