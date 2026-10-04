/**
 * Deterministic nutrition arithmetic (spec §18).
 * Pure typed functions — never delegated to an LLM.
 */

import type { FoodItem, NutritionSnapshot } from "@/types/nutrition";
import { convertQuantity, normalizeUnit } from "@/lib/nutrition/units";

export function emptySnapshot(): NutritionSnapshot {
  return {
    calories: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    fiberG: 0,
    sugarG: 0,
    sodiumMg: 0,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Scale a snapshot by a factor and round for storage/display. */
export function scaleSnapshot(
  snapshot: NutritionSnapshot,
  factor: number,
): NutritionSnapshot {
  if (!Number.isFinite(factor) || factor <= 0) {
    throw new Error(`Invalid nutrition scale factor: ${factor}`);
  }
  const micros = snapshot.micronutrients
    ? Object.fromEntries(
        Object.entries(snapshot.micronutrients).map(([k, v]) => [k, round1(v * factor)]),
      )
    : undefined;

  return {
    calories: Math.round(snapshot.calories * factor),
    proteinG: round1(snapshot.proteinG * factor),
    carbsG: round1(snapshot.carbsG * factor),
    fatG: round1(snapshot.fatG * factor),
    fiberG: round1(snapshot.fiberG * factor),
    sugarG: round1(snapshot.sugarG * factor),
    sodiumMg: Math.round(snapshot.sodiumMg * factor),
    ...(micros ? { micronutrients: micros } : {}),
  };
}

/** Snapshot of a food item at its reference serving (usually per 100 g). */
export function foodReferenceSnapshot(food: FoodItem): NutritionSnapshot {
  return {
    calories: Number(food.calories),
    proteinG: Number(food.proteinG),
    carbsG: Number(food.carbsG),
    fatG: Number(food.fatG),
    fiberG: Number(food.fiberG),
    sugarG: Number(food.sugarG),
    sodiumMg: Number(food.sodiumMg),
    ...(Object.keys(food.micronutrients ?? {}).length > 0
      ? { micronutrients: food.micronutrients }
      : {}),
  };
}

/**
 * Compute the nutrition snapshot for a logged quantity of a food.
 *
 * nutrition = reference_values × (converted_quantity / reference_serving_size)
 *
 * @param densityGPerMl optional density to bridge mass ↔ volume units.
 * @returns null when the units are incompatible or the quantity is invalid
 *   (callers must surface this, never guess — spec §38).
 */
export function computeLogNutrition(
  food: FoodItem,
  quantity: number,
  unit: string,
  densityGPerMl?: number,
): NutritionSnapshot | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  const servingSize = Number(food.servingSize);
  if (!Number.isFinite(servingSize) || servingSize <= 0) return null;

  const from = normalizeUnit(unit);
  const to = normalizeUnit(food.servingUnit);

  let converted: number | null;
  if (from === to) {
    converted = quantity;
  } else if (from === "unit" || to === "unit") {
    // Count units: only valid when the reference serving IS the count unit,
    // e.g. "1 boiled egg" where household metadata says 50 g. Callers should
    // pre-resolve count units to mass via household_serving; reject otherwise.
    return null;
  } else {
    converted = convertQuantity(quantity, from, to, densityGPerMl);
  }
  if (converted === null) return null;

  return scaleSnapshot(foodReferenceSnapshot(food), converted / servingSize);
}

/** Sum snapshots (daily totals, meal totals, recipe totals). */
export function sumSnapshots(snapshots: NutritionSnapshot[]): NutritionSnapshot {
  const total = emptySnapshot();
  const micros: Record<string, number> = {};

  for (const s of snapshots) {
    total.calories += s.calories;
    total.proteinG += s.proteinG;
    total.carbsG += s.carbsG;
    total.fatG += s.fatG;
    total.fiberG += s.fiberG;
    total.sugarG += s.sugarG;
    total.sodiumMg += s.sodiumMg;
    if (s.micronutrients) {
      for (const [k, v] of Object.entries(s.micronutrients)) {
        micros[k] = (micros[k] ?? 0) + v;
      }
    }
  }

  const rounded = scaleSnapshot(
    { ...total, ...(Object.keys(micros).length > 0 ? { micronutrients: micros } : {}) },
    1,
  );
  return rounded;
}

/** Remaining = target − consumed, floored display helper (can go negative). */
export function remaining(target: number, consumed: number): number {
  return Math.round((target - consumed) * 10) / 10;
}

/** Protein/carbs/fat calorie split for display (percentages summing ~100). */
export function macroCalorieSplit(s: NutritionSnapshot): {
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
  totalKcal: number;
} {
  const p = s.proteinG * 4;
  const c = s.carbsG * 4;
  const f = s.fatG * 9;
  const sum = p + c + f;
  if (sum <= 0) return { proteinPct: 0, carbsPct: 0, fatPct: 0, totalKcal: 0 };
  return {
    proteinPct: Math.round((p / sum) * 100),
    carbsPct: Math.round((c / sum) * 100),
    fatPct: Math.round((f / sum) * 100),
    totalKcal: Math.round(sum),
  };
}
