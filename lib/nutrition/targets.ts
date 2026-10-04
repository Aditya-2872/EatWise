/**
 * Deterministic calorie/macro target calculation (spec §11, §20).
 * Mifflin-St Jeor BMR × activity factor ± goal delta, with safety floors.
 */

import type { NutritionTargets, Sex, TargetProfile } from "@/types/nutrition";
import {
  ACTIVITY_FACTORS,
  FAT_CALORIE_FRACTION,
  GOAL_CALORIE_DELTA,
  GOAL_PROTEIN_PER_KG,
  KCAL_PER_G,
  MIN_CALORIE_TARGET,
} from "@/lib/constants/nutrition";

/** Mifflin-St Jeor equation. 'other' → mean of male/female formulas. */
export function bmrMifflinStJeor(
  sex: Sex,
  weightKg: number,
  heightCm: number,
  ageYears: number,
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  switch (sex) {
    case "male":
      return base + 5;
    case "female":
      return base - 161;
    case "other":
      return base + (5 - 161) / 2;
  }
}

export function tdee(bmr: number, activityLevel: TargetProfile["activityLevel"]): number {
  return bmr * ACTIVITY_FACTORS[activityLevel];
}

export function minCalorieFloor(sex: Sex): number {
  return MIN_CALORIE_TARGET[sex === "male" ? "male" : sex === "female" ? "female" : "other"];
}

/**
 * Full target calculation. All outputs rounded deterministically:
 * calories to nearest 25 kcal, macros to whole grams.
 */
export function calculateTargets(profile: TargetProfile): NutritionTargets {
  const bmr = bmrMifflinStJeor(
    profile.sex,
    profile.weightKg,
    profile.heightCm,
    profile.ageYears,
  );
  const maintenance = tdee(bmr, profile.activityLevel);

  const delta = GOAL_CALORIE_DELTA[profile.goalType];
  const rawTarget = maintenance + delta;
  const floor = minCalorieFloor(profile.sex);
  const calorieTarget = Math.max(floor, Math.round(rawTarget / 25) * 25);

  // Protein: g per kg body weight by goal.
  const proteinTargetG = Math.round(
    profile.weightKg * GOAL_PROTEIN_PER_KG[profile.goalType],
  );

  // Fat: fixed fraction of the calorie target; carbs take the remainder.
  const fatTargetG = Math.max(
    30, // physiological floor
    Math.round((calorieTarget * FAT_CALORIE_FRACTION) / KCAL_PER_G.fat),
  );

  const usedKcal = proteinTargetG * KCAL_PER_G.protein + fatTargetG * KCAL_PER_G.fat;
  const carbTargetG = Math.max(
    0,
    Math.round((calorieTarget - usedKcal) / KCAL_PER_G.carbs),
  );

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(maintenance),
    calorieTarget,
    proteinTargetG,
    carbTargetG,
    fatTargetG,
    explanation: buildExplanation(
      profile,
      bmr,
      maintenance,
      calorieTarget,
      floor,
      rawTarget < floor,
    ),
  };
}

function buildExplanation(
  profile: TargetProfile,
  bmr: number,
  maintenance: number,
  calorieTarget: number,
  floor: number,
  clamped: boolean,
): string {
  const goalLabels: Record<TargetProfile["goalType"], string> = {
    lose_weight: "lose weight",
    gain_weight: "gain weight",
    build_muscle: "build muscle",
    recomposition: "body recomposition",
    maintain: "maintain weight",
    improve_nutrition: "improve nutrition",
  };
  const activityLabels: Record<TargetProfile["activityLevel"], string> = {
    sedentary: "sedentary",
    light: "lightly active",
    moderate: "moderately active",
    active: "very active",
    very_active: "extremely active",
  };

  const delta = calorieTarget - Math.round(maintenance);

  return (
    `Your estimated maintenance intake is about ${Math.round(maintenance)} kcal/day ` +
    `(BMR ${Math.round(bmr)} × ${activityLabels[profile.activityLevel]} activity). ` +
    `To ${goalLabels[profile.goalType]}, your starting target is ${calorieTarget} kcal/day` +
    (delta !== 0 && !clamped
      ? ` (${delta > 0 ? "+" : ""}${delta} kcal vs maintenance)`
      : "") +
    (clamped
      ? ` (limited to a safe minimum of ${floor} kcal — progress may be slower)`
      : "") +
    `. Protein is set at ${Math.round(profile.weightKg * GOAL_PROTEIN_PER_KG[profile.goalType])}g ` +
    `for your goal and weight. These are estimates, not medical prescriptions — ` +
    `we'll adapt them as real progress data comes in.`
  );
}
