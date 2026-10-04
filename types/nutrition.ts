/**
 * Domain types shared across the nutrition engine, API and UI.
 * All nutrition values are deterministic — computed server-side, never by an LLM.
 */

/** Frozen nutrition values stored on every food_log (spec §13). */
export type NutritionSnapshot = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
  /** Optional micros keyed by nutrient name, e.g. { calcium_mg: 120 }. */
  micronutrients?: Record<string, number>;
};

/** Normalized master food record (food_items table). */
export type FoodItem = {
  id: string;
  name: string;
  normalizedName: string;
  brand: string | null;
  barcode: string | null;
  source: string;
  sourceId: string | null;
  verificationStatus: "verified" | "semi_verified" | "unverified" | "user_reported";
  /** Reference amount the macro values below are per (usually 100 g). */
  servingSize: number;
  servingUnit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
  micronutrients: Record<string, number>;
  metadata: FoodMetadata;
};

export type HouseholdServing = {
  quantity: number;
  unit: string;
  label: string;
};

export type FoodMetadata = {
  category?: string;
  household_serving?: HouseholdServing;
  [key: string]: unknown;
};

export type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "custom";

export type LogSource =
  | "manual"
  | "photo_ai"
  | "barcode"
  | "voice"
  | "text"
  | "saved_meal"
  | "recipe"
  | "search";

export type FoodLog = {
  id: string;
  userId: string;
  foodId: string | null;
  mealId: string | null;
  quantity: number;
  unit: string;
  mealType: MealType;
  loggedAt: string;
  source: LogSource;
  confidence: number | null;
  nutritionSnapshot: NutritionSnapshot;
  aiMetadata: Record<string, unknown> | null;
  /** Joined display info (not persisted). */
  foodName?: string | null;
  foodBrand?: string | null;
};

export type Sex = "male" | "female" | "other";

export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";

export type GoalType =
  | "lose_weight"
  | "gain_weight"
  | "build_muscle"
  | "recomposition"
  | "maintain"
  | "improve_nutrition";

export type TargetProfile = {
  sex: Sex;
  ageYears: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goalType: GoalType;
};

export type NutritionTargets = {
  bmr: number;
  tdee: number;
  calorieTarget: number;
  proteinTargetG: number;
  carbTargetG: number;
  fatTargetG: number;
  explanation: string;
};

export type WeightEntry = {
  id: string;
  weightKg: number;
  recordedAt: string;
  source: string;
  notes: string | null;
};
