/**
 * Goals & onboarding service (spec §11, §20).
 * Targets are computed deterministically server-side (Mifflin-St Jeor →
 * TDEE → goal delta → safety floors) and frozen onto the active goal row.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { NutritionTargets } from "@/types/nutrition";
import { calculateTargets } from "@/lib/nutrition/targets";
import { ageFromDob, type OnboardingInput } from "@/lib/validation/goals";

export interface ActiveGoalRow {
  id: string;
  goal_type: string;
  target_weight_kg: number | null;
  target_rate_per_week: number | null;
  calorie_target: number;
  protein_target_g: number;
  carb_target_g: number;
  fat_target_g: number;
  start_date: string;
  is_active: boolean;
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function getActiveGoal(
  supabase: SupabaseClient,
  userId: string,
): Promise<ActiveGoalRow | null> {
  const { data, error } = await supabase
    .from("user_goals")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  if (error || !data) return null;
  const g = data as Record<string, unknown>;
  return {
    id: String(g.id),
    goal_type: String(g.goal_type),
    target_weight_kg: g.target_weight_kg == null ? null : num(g.target_weight_kg),
    target_rate_per_week: g.target_rate_per_week == null ? null : num(g.target_rate_per_week),
    calorie_target: num(g.calorie_target),
    protein_target_g: num(g.protein_target_g),
    carb_target_g: num(g.carb_target_g),
    fat_target_g: num(g.fat_target_g),
    start_date: String(g.start_date),
    is_active: Boolean(g.is_active),
  };
}

export interface OnboardingResult {
  ok: boolean;
  error?: string;
  targets?: NutritionTargets;
}

/**
 * Complete onboarding: profile fields, first weight entry, dietary
 * preference, and the first active goal with computed targets.
 * Re-running onboarding replaces the active goal (history is kept).
 */
export async function completeOnboarding(
  supabase: SupabaseClient,
  userId: string,
  input: OnboardingInput,
): Promise<OnboardingResult> {
  const age = ageFromDob(input.dateOfBirth);
  if (age == null) return { ok: false, error: "Invalid date of birth." };

  const targets = calculateTargets({
    sex: input.sex,
    ageYears: age,
    heightCm: input.heightCm,
    weightKg: input.weightKg,
    activityLevel: input.activityLevel,
    goalType: input.goalType,
  });

  // 1. Profile
  const { error: profileErr } = await supabase
    .from("profiles")
    .update({
      ...(input.displayName ? { display_name: input.displayName } : {}),
      sex: input.sex,
      date_of_birth: input.dateOfBirth,
      height_cm: input.heightCm,
      current_weight_kg: input.weightKg,
      activity_level: input.activityLevel,
      timezone: input.timeZone ?? "Asia/Kolkata",
      onboarding_completed: true,
    })
    .eq("id", userId);
  if (profileErr) {
    console.error("[goals] profile update failed:", profileErr.message);
    return { ok: false, error: "Could not save your profile." };
  }

  // 2. Starting weight entry
  const { error: weightErr } = await supabase.from("weight_entries").insert({
    user_id: userId,
    weight_kg: input.weightKg,
    source: "onboarding",
  });
  if (weightErr) console.error("[goals] weight insert failed:", weightErr.message);

  // 3. Dietary preference
  if (input.dietType) {
    await supabase
      .from("dietary_preferences")
      .upsert({ user_id: userId, diet_type: input.dietType }, { onConflict: "user_id" });
  }

  // 4. Replace active goal
  await supabase
    .from("user_goals")
    .update({ is_active: false, end_date: new Date().toISOString().slice(0, 10) })
    .eq("user_id", userId)
    .eq("is_active", true);

  const { error: goalErr } = await supabase.from("user_goals").insert({
    user_id: userId,
    goal_type: input.goalType,
    target_weight_kg: input.targetWeightKg ?? null,
    target_rate_per_week: input.targetRatePerWeek ?? null,
    calorie_target: targets.calorieTarget,
    protein_target_g: targets.proteinTargetG,
    carb_target_g: targets.carbTargetG,
    fat_target_g: targets.fatTargetG,
    is_active: true,
  });
  if (goalErr) {
    console.error("[goals] goal insert failed:", goalErr.message);
    return { ok: false, error: "Could not save your goal." };
  }

  return { ok: true, targets };
}

/* ------------------------------------------------------------------ */
/* Goal update (post-onboarding)                                       */
/* ------------------------------------------------------------------ */

export interface UpdateGoalInput {
  goalType: string;
  targetWeightKg?: number | null;
  targetRatePerWeek?: number | null;
  activityLevel?: string;
}

/**
 * Replace the active goal after onboarding. Recomputes targets from the
 * stored profile (sex, dob, height, weight) plus the current/overridden
 * activity level. Refuses if onboarding data is missing (no silent guesses).
 */
export async function updateGoal(
  supabase: SupabaseClient,
  userId: string,
  input: UpdateGoalInput,
): Promise<OnboardingResult> {
  const { data: profileRaw } = await supabase
    .from("profiles")
    .select("sex, date_of_birth, height_cm, current_weight_kg, activity_level, onboarding_completed")
    .eq("id", userId)
    .maybeSingle();
  const p = profileRaw as Record<string, unknown> | null;

  if (!p || !p.onboarding_completed) {
    return { ok: false, error: "Please complete onboarding before changing your goal." };
  }
  const sex = p.sex as string | null;
  const dob = p.date_of_birth as string | null;
  const heightCm = p.height_cm == null ? null : Number(p.height_cm);
  const weightKg = p.current_weight_kg == null ? null : Number(p.current_weight_kg);
  const activityLevel = (input.activityLevel ?? (p.activity_level as string | null)) as string | null;

  if (!sex || !dob || !heightCm || !weightKg || !activityLevel) {
    return { ok: false, error: "Your profile is incomplete, so targets can't be recomputed." };
  }
  const age = ageFromDob(dob);
  if (age == null) return { ok: false, error: "Invalid date of birth on profile." };

  const targets = calculateTargets({
    sex: sex as never,
    ageYears: age,
    heightCm,
    weightKg,
    activityLevel: activityLevel as never,
    goalType: input.goalType as never,
  });

  await supabase
    .from("user_goals")
    .update({ is_active: false, end_date: new Date().toISOString().slice(0, 10) })
    .eq("user_id", userId)
    .eq("is_active", true);

  const { error: goalErr } = await supabase.from("user_goals").insert({
    user_id: userId,
    goal_type: input.goalType,
    target_weight_kg: input.targetWeightKg ?? null,
    target_rate_per_week: input.targetRatePerWeek ?? null,
    calorie_target: targets.calorieTarget,
    protein_target_g: targets.proteinTargetG,
    carb_target_g: targets.carbTargetG,
    fat_target_g: targets.fatTargetG,
    is_active: true,
  });
  if (goalErr) {
    console.error("[goals] goal update failed:", goalErr.message);
    return { ok: false, error: "Could not update your goal." };
  }

  // Persist activity level if it changed.
  if (input.activityLevel && input.activityLevel !== p.activity_level) {
    await supabase
      .from("profiles")
      .update({ activity_level: input.activityLevel })
      .eq("id", userId);
  }

  return { ok: true, targets };
}
