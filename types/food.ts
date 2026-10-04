import type { FoodMetadata } from "./nutrition";

/**
 * Food-domain types matching the Postgres schema (supabase/migrations/0001).
 * `food_items` stores flat macro columns per reference serving (usually 100 g);
 * micronutrients live in a JSONB map.
 */

export type FoodSourceName = "seed" | "usda" | "openfoodfacts" | "user" | "ai";
export type VerificationStatus = "verified" | "semi_verified" | "unverified" | "user_reported";

/** Row shape of `food_items`. */
export interface FoodItemRow {
  id: string;
  name: string;
  normalized_name: string;
  brand: string | null;
  barcode: string | null;
  source: FoodSourceName;
  source_id: string | null;
  verification_status: VerificationStatus;
  serving_size: number;
  serving_unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  micronutrients: Record<string, number>;
  metadata: FoodMetadata;
}

/** `search_foods()` RPC row. */
export interface FoodSearchResult extends FoodItemRow {
  score: number;
}

/** `recent_foods()` RPC row (food_items ⋈ user_foods). */
export interface UserFoodRow extends FoodItemRow {
  usage_count: number;
  last_used_at: string | null;
  custom_name: string | null;
  usual_quantity: number | null;
  usual_unit: string | null;
}

/**
 * An external food (USDA / Open Food Facts) after normalization.
 * Cached into `food_items` before being referenced by logs, so history
 * never depends on a live external API (spec §13).
 */
export interface NormalizedExternalFood {
  source: "usda" | "openfoodfacts";
  source_id: string;
  name: string;
  brand?: string | null;
  barcode?: string | null;
  category?: string | null;
  image_url?: string | null;
  /** Per 100 g edible portion. */
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  micronutrients: Record<string, number>;
  /** Manufacturer/reference serving, when known. */
  serving_grams: number | null;
  serving_label: string | null;
  source_url?: string | null;
  source_metadata?: Record<string, unknown>;
}
