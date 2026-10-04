/** Named constants for the nutrition engine (no magic numbers — spec §42). */

/** Kilocalories per gram of each macronutrient (Atwater factors). */
export const KCAL_PER_G = {
  protein: 4,
  carbs: 4,
  fat: 9,
} as const;

/** Caloric equivalent of 1 kg of body-weight change (~7700 kcal). */
export const KCAL_PER_KG_BODYWEIGHT = 7700;

/** Activity multipliers applied to BMR (Mifflin-St Jeor). */
export const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
} as const;

/** Default daily kcal delta from TDEE per goal type. */
export const GOAL_CALORIE_DELTA = {
  lose_weight: -500,
  gain_weight: 400,
  build_muscle: 300,
  recomposition: 0,
  maintain: 0,
  improve_nutrition: 0,
} as const;

/** Protein target in g per kg of body weight per goal type. */
export const GOAL_PROTEIN_PER_KG = {
  lose_weight: 1.8,
  gain_weight: 1.8,
  build_muscle: 2.0,
  recomposition: 1.8,
  maintain: 1.2,
  improve_nutrition: 1.2,
} as const;

/** Safety floors — never target below these (not medical advice, general guidance). */
export const MIN_CALORIE_TARGET = {
  male: 1500,
  female: 1200,
  other: 1200,
} as const;

/** Fraction of calories from fat used when splitting remaining macros. */
export const FAT_CALORIE_FRACTION = 0.25;

/** AI confidence thresholds (spec §5 — Smart Clarification). */
export const CONFIDENCE = {
  /** Below this, flag the item as low confidence in the UI. */
  low: 0.55,
  /** Below this, always ask for clarification when it can improve the estimate. */
  needsClarification: 0.7,
  high: 0.85,
} as const;

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack", "custom"] as const;

/** Local hour ranges used to preselect the meal type. */
export const MEAL_TIME_RANGES = {
  breakfast: [4, 11],
  lunch: [11, 15],
  snack: [15, 18],
  dinner: [18, 28], // wraps past midnight; 28 → 4am next day
} as const;

/** Image upload limits (spec §32 — validated again server-side). */
export const IMAGE_UPLOAD = {
  maxBytes: 5 * 1024 * 1024,
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  maxEdgePx: 1600, // client-side compression target
  jpegQuality: 0.85,
} as const;
