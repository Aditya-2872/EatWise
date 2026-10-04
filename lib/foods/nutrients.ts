/**
 * Normalization of external nutrient payloads (USDA / Open Food Facts) into
 * the internal flat per-100 g shape (spec §13.3: external APIs sit behind a
 * normalization layer; the rest of the app only sees internal shapes).
 */

/** Micronutrient keys stored in `food_items.micronutrients`. */
export type MicroKey =
  | "calcium_mg"
  | "iron_mg"
  | "potassium_mg"
  | "zinc_mg"
  | "vitamin_a_ug_rae"
  | "vitamin_c_mg"
  | "vitamin_d_ug"
  | "vitamin_e_mg"
  | "vitamin_k_ug";

export interface NormalizedNutrition {
  /** Per 100 g. */
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  /** Keys are `MicroKey` strings; only present nutrients are included. */
  micronutrients: Record<string, number>;
}

/** USDA FoodData Central nutrient numbers used by EatWise. */
export const USDA_NUTRIENT_NUMBERS = {
  energy_kcal: "208",
  protein_g: "203",
  fat_g: "204",
  carbohydrate_g: "205",
  fiber_g: "291",
  sugar_g: "269",
  calcium_mg: "301",
  iron_mg: "303",
  potassium_mg: "306",
  sodium_mg: "307",
  zinc_mg: "309",
  vitamin_a_ug_rae: "320",
  vitamin_e_mg: "323",
  vitamin_d_ug: "328",
  vitamin_c_mg: "401",
  vitamin_k_ug: "430",
} as const;

interface RawNutrient {
  nutrientNumber?: string;
  nutrientId?: number;
  amount?: number | null;
}

/**
 * Build normalized per-100 g nutrition from USDA `foodNutrients`.
 * USDA amounts are per 100 g edible portion in the nutrient's own unit
 * (kcal, g, mg, µg), which matches the internal units 1:1.
 * Returns null when core macros are missing (food is not loggable).
 */
export function nutritionFromUsda(nutrients: RawNutrient[]): NormalizedNutrition | null {
  const byNumber = new Map<string, number>();
  for (const n of nutrients) {
    const num =
      n.nutrientNumber ?? (n.nutrientId != null ? String(n.nutrientId) : undefined);
    if (num && n.amount != null && Number.isFinite(n.amount)) byNumber.set(num, n.amount);
  }
  const get = (num: string): number | null => {
    const v = byNumber.get(num);
    return v == null ? null : round(v);
  };

  const calories = get(USDA_NUTRIENT_NUMBERS.energy_kcal);
  const protein = get(USDA_NUTRIENT_NUMBERS.protein_g);
  const carbs = get(USDA_NUTRIENT_NUMBERS.carbohydrate_g);
  const fat = get(USDA_NUTRIENT_NUMBERS.fat_g);
  if (calories == null || calories <= 0 || protein == null || carbs == null || fat == null) {
    return null;
  }

  const microDefs: Array<[MicroKey, string]> = [
    ["calcium_mg", USDA_NUTRIENT_NUMBERS.calcium_mg],
    ["iron_mg", USDA_NUTRIENT_NUMBERS.iron_mg],
    ["potassium_mg", USDA_NUTRIENT_NUMBERS.potassium_mg],
    ["zinc_mg", USDA_NUTRIENT_NUMBERS.zinc_mg],
    ["vitamin_a_ug_rae", USDA_NUTRIENT_NUMBERS.vitamin_a_ug_rae],
    ["vitamin_c_mg", USDA_NUTRIENT_NUMBERS.vitamin_c_mg],
    ["vitamin_d_ug", USDA_NUTRIENT_NUMBERS.vitamin_d_ug],
    ["vitamin_e_mg", USDA_NUTRIENT_NUMBERS.vitamin_e_mg],
    ["vitamin_k_ug", USDA_NUTRIENT_NUMBERS.vitamin_k_ug],
  ];
  const micronutrients: Record<string, number> = {};
  for (const [key, num] of microDefs) {
    const v = get(num);
    if (v != null) micronutrients[key] = v;
  }

  return {
    calories,
    protein_g: protein,
    carbs_g: carbs,
    fat_g: fat,
    fiber_g: get(USDA_NUTRIENT_NUMBERS.fiber_g),
    sugar_g: get(USDA_NUTRIENT_NUMBERS.sugar_g),
    sodium_mg: get(USDA_NUTRIENT_NUMBERS.sodium_mg),
    micronutrients,
  };
}

/**
 * Normalize Open Food Facts `nutriments`.
 * OFF stores mass nutriments in grams per 100 g (energy separately as
 * `energy-kcal_100g`, or `energy_100g` in kJ). Returns null when core
 * macros are missing.
 */
export function nutritionFromOff(n: Record<string, unknown>): NormalizedNutrition | null {
  const num = (key: string): number | null => {
    const v = n[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      const p = Number(v);
      return Number.isFinite(p) ? p : null;
    }
    return null;
  };
  const gTo = (key: string, factor: number): number | null => {
    const v = num(`${key}_100g`);
    return v == null ? null : round(v * factor);
  };

  let calories = num("energy-kcal_100g");
  if (calories == null) {
    const kj = num("energy_100g");
    if (kj != null) calories = kj / 4.184;
  }
  const protein = gTo("proteins", 1);
  const carbs = gTo("carbohydrates", 1);
  const fat = gTo("fat", 1);
  if (calories == null || calories <= 0 || protein == null || carbs == null || fat == null) {
    return null;
  }

  const microDefs: Array<[MicroKey, string, number]> = [
    ["calcium_mg", "calcium", 1000],
    ["iron_mg", "iron", 1000],
    ["potassium_mg", "potassium", 1000],
    ["zinc_mg", "zinc", 1000],
    ["vitamin_a_ug_rae", "vitamin-a", 1e6],
    ["vitamin_c_mg", "vitamin-c", 1000],
    ["vitamin_d_ug", "vitamin-d", 1e6],
    ["vitamin_e_mg", "vitamin-e", 1000],
    ["vitamin_k_ug", "vitamin-k", 1e6],
  ];
  const micronutrients: Record<string, number> = {};
  for (const [key, offKey, factor] of microDefs) {
    const v = gTo(offKey, factor);
    if (v != null) micronutrients[key] = v;
  }

  return {
    calories: round(calories),
    protein_g: protein,
    carbs_g: carbs,
    fat_g: fat,
    fiber_g: gTo("fiber", 1),
    sugar_g: gTo("sugars", 1),
    sodium_mg: gTo("sodium", 1000),
    micronutrients,
  };
}

/**
 * Parse a serving description like "30 g", "1 cup (240 g)" or a numeric
 * servingSize+unit into grams. Returns null when it cannot be determined.
 */
export function parseServingGrams(
  servingSize: number | string | null | undefined,
  unit?: string | null,
): number | null {
  if (typeof servingSize === "number" && Number.isFinite(servingSize)) {
    if (!unit) return round(servingSize); // USDA servingSize without unit: grams
    return unitToGrams(servingSize, unit);
  }
  if (typeof servingSize === "string" && servingSize.trim()) {
    // Prefer a parenthesized gram weight: "1 cup (240 g)"
    const paren = servingSize.match(/\((\d+(?:\.\d+)?)\s*g\)/i);
    if (paren) return round(Number(paren[1]));
    const m = servingSize.match(/^(\d+(?:\.\d+)?)\s*(g|kg|mg)?$/i);
    if (m) return unitToGrams(Number(m[1]), m[2] ?? "g");
  }
  return null;
}

function unitToGrams(value: number, unit: string): number | null {
  switch (unit.toLowerCase()) {
    case "g":
      return round(value);
    case "kg":
      return round(value * 1000);
    case "mg":
      return round(value / 1000);
    default:
      // Volume without density: never guess.
      return null;
  }
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}
