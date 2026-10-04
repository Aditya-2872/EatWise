/**
 * Internal food repository — Postgres is the first source of truth (spec §13).
 * All functions take an explicit Supabase client so the caller controls the
 * security context (user-scoped via RLS, or service role for cache writes).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  FoodItemRow,
  FoodSearchResult,
  NormalizedExternalFood,
  UserFoodRow,
} from "@/types/food";
import type { FoodMetadata } from "@/types/nutrition";
import { normalizeFoodName } from "@/lib/foods/normalize";

const FOOD_COLUMNS =
  "id, name, normalized_name, brand, barcode, source, source_id, verification_status, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, micronutrients, metadata";

/* ------------------------------------------------------------------ */
/* Row mapping (PostgREST returns numeric columns as strings)          */
/* ------------------------------------------------------------------ */

type Raw = Record<string, unknown>;

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function mapFoodRow(raw: Raw): FoodItemRow {
  return {
    id: String(raw.id),
    name: String(raw.name ?? ""),
    normalized_name: String(raw.normalized_name ?? ""),
    brand: strOrNull(raw.brand),
    barcode: strOrNull(raw.barcode),
    source: (String(raw.source ?? "seed") as FoodItemRow["source"]),
    source_id: strOrNull(raw.source_id),
    verification_status: String(raw.verification_status ?? "unverified") as FoodItemRow["verification_status"],
    serving_size: num(raw.serving_size, 100),
    serving_unit: String(raw.serving_unit ?? "g"),
    calories: num(raw.calories),
    protein_g: num(raw.protein_g),
    carbs_g: num(raw.carbs_g),
    fat_g: num(raw.fat_g),
    fiber_g: num(raw.fiber_g),
    sugar_g: num(raw.sugar_g),
    sodium_mg: num(raw.sodium_mg),
    micronutrients: Object.fromEntries(
      Object.entries(obj(raw.micronutrients)).map(([k, v]) => [k, num(v)]),
    ),
    metadata: obj(raw.metadata) as FoodMetadata,
  };
}

function mapSearchRow(raw: Raw): FoodSearchResult {
  return { ...mapFoodRow(raw), score: num(raw.score) };
}

function mapUserFoodRow(raw: Raw): UserFoodRow {
  return {
    ...mapFoodRow(raw),
    usage_count: num(raw.usage_count),
    last_used_at: strOrNull(raw.last_used_at),
    custom_name: strOrNull(raw.custom_name),
    usual_quantity: numOrNull(raw.usual_quantity),
    usual_unit: strOrNull(raw.usual_unit),
  };
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

/** Ranked internal search via the `search_foods` RPC (security invoker). */
export async function searchInternalFoods(
  supabase: SupabaseClient,
  query: string,
  userId: string | null,
  limit = 12,
): Promise<FoodSearchResult[]> {
  const { data, error } = await supabase.rpc("search_foods", {
    p_query: query,
    p_user_id: userId,
    p_limit: limit,
  });
  if (error) {
    console.error("[foods] search_foods rpc failed:", error.message);
    return [];
  }
  return ((data ?? []) as Raw[]).map(mapSearchRow);
}

export async function getFoodById(
  supabase: SupabaseClient,
  foodId: string,
): Promise<FoodItemRow | null> {
  const { data, error } = await supabase
    .from("food_items")
    .select(FOOD_COLUMNS)
    .eq("id", foodId)
    .maybeSingle();
  if (error) {
    console.error("[foods] getFoodById failed:", error.message);
    return null;
  }
  return data ? mapFoodRow(data as Raw) : null;
}

export async function getFoodsByIds(
  supabase: SupabaseClient,
  foodIds: string[],
): Promise<Map<string, FoodItemRow>> {
  const ids = [...new Set(foodIds)].slice(0, 100);
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase
    .from("food_items")
    .select(FOOD_COLUMNS)
    .in("id", ids);
  if (error) {
    console.error("[foods] getFoodsByIds failed:", error.message);
    return new Map();
  }
  const rows = ((data ?? []) as Raw[]).map(mapFoodRow);
  return new Map(rows.map((r) => [r.id, r]));
}

export async function getFoodByBarcode(
  supabase: SupabaseClient,
  barcode: string,
): Promise<FoodItemRow | null> {
  const { data, error } = await supabase
    .from("food_items")
    .select(FOOD_COLUMNS)
    .eq("barcode", barcode)
    .maybeSingle();
  if (error) return null;
  return data ? mapFoodRow(data as Raw) : null;
}

/** Recent & frequent personal foods (Log screen quick list). */
export async function recentFoods(
  supabase: SupabaseClient,
  userId: string,
  limit = 10,
): Promise<UserFoodRow[]> {
  const { data, error } = await supabase.rpc("recent_foods", {
    p_user_id: userId,
    p_limit: limit,
  });
  if (error) {
    console.error("[foods] recent_foods rpc failed:", error.message);
    return [];
  }
  return ((data ?? []) as Raw[]).map(mapUserFoodRow);
}

/* ------------------------------------------------------------------ */
/* Personal food memory (user_foods)                                   */
/* ------------------------------------------------------------------ */

/**
 * Record that a user logged a food: bumps usage_count / last_used_at and
 * remembers their usual quantity. Idempotent-safe upsert (own rows, RLS).
 */
export async function recordUsage(
  supabase: SupabaseClient,
  userId: string,
  foodId: string,
  usual?: { quantity: number; unit: string } | null,
): Promise<void> {
  const { data: existing } = await supabase
    .from("user_foods")
    .select("id, usage_count")
    .eq("user_id", userId)
    .eq("food_id", foodId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("user_foods")
      .update({
        usage_count: num(existing.usage_count) + 1,
        last_used_at: new Date().toISOString(),
        ...(usual ? { usual_quantity: usual.quantity, usual_unit: usual.unit } : {}),
      })
      .eq("id", existing.id);
    if (error) console.error("[foods] recordUsage update failed:", error.message);
    return;
  }

  const { error } = await supabase.from("user_foods").insert({
    user_id: userId,
    food_id: foodId,
    usage_count: 1,
    last_used_at: new Date().toISOString(),
    ...(usual ? { usual_quantity: usual.quantity, usual_unit: usual.unit } : {}),
  });
  if (error) console.error("[foods] recordUsage insert failed:", error.message);
}

/* ------------------------------------------------------------------ */
/* External food cache (service role only — bypasses RLS)              */
/* ------------------------------------------------------------------ */

/**
 * Cache a normalized external food into `food_items`, deduplicated by
 * (source, source_id) and by barcode. Returns the internal row, or null on
 * failure — callers must then drop the result rather than reference an
 * uncached external id.
 */
export async function cacheExternalFood(
  admin: SupabaseClient,
  food: NormalizedExternalFood,
): Promise<FoodItemRow | null> {
  const existing = await findCached(admin, food);
  if (existing) return existing;

  const metadata: FoodMetadata = {
    ...(food.category ? { category: food.category } : {}),
    ...(food.image_url ? { image_url: food.image_url } : {}),
    ...(food.serving_grams != null
      ? {
          reference_serving: {
            grams: food.serving_grams,
            label: food.serving_label ?? `${food.serving_grams} g`,
          },
        }
      : {}),
    external: {
      provider: food.source,
      external_id: food.source_id,
      retrieved_at: new Date().toISOString(),
      ...(food.source_metadata ?? {}),
    },
  };

  const payload = {
    name: food.name,
    normalized_name: normalizeFoodName(food.name),
    brand: food.brand ?? null,
    barcode: food.barcode ?? null,
    source: food.source,
    source_id: food.source_id,
    verification_status: "semi_verified",
    serving_size: 100,
    serving_unit: "g",
    calories: food.calories,
    protein_g: food.protein_g,
    carbs_g: food.carbs_g,
    fat_g: food.fat_g,
    fiber_g: food.fiber_g ?? 0,
    sugar_g: food.sugar_g ?? 0,
    sodium_mg: food.sodium_mg ?? 0,
    micronutrients: food.micronutrients,
    metadata,
  };

  const { data, error } = await admin
    .from("food_items")
    .insert(payload)
    .select(FOOD_COLUMNS)
    .single();

  if (error) {
    // Unique-violation race (source/source_id or barcode): re-select.
    if (error.code === "23505") {
      return findCached(admin, food);
    }
    console.error("[foods] cacheExternalFood insert failed:", error.message);
    return null;
  }

  const row = mapFoodRow(data as Raw);

  // Provenance record (spec §24 food_sources).
  const { error: provErr } = await admin.from("food_sources").insert({
    food_id: row.id,
    provider: food.source,
    external_id: food.source_id,
    source_url: food.source_url ?? null,
  });
  if (provErr) console.error("[foods] provenance insert failed:", provErr.message);

  return row;
}

async function findCached(
  admin: SupabaseClient,
  food: NormalizedExternalFood,
): Promise<FoodItemRow | null> {
  const { data: bySource } = await admin
    .from("food_items")
    .select(FOOD_COLUMNS)
    .eq("source", food.source)
    .eq("source_id", food.source_id)
    .maybeSingle();
  if (bySource) return mapFoodRow(bySource as Raw);

  if (food.barcode) {
    const { data: byBarcode } = await admin
      .from("food_items")
      .select(FOOD_COLUMNS)
      .eq("barcode", food.barcode)
      .maybeSingle();
    if (byBarcode) return mapFoodRow(byBarcode as Raw);
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Owner scoping for private (user/AI-created) foods                   */
/* ------------------------------------------------------------------ */

/**
 * `user`- and `ai`-sourced foods carry `metadata.owner_user_id` and are
 * private to that user (the search RPC filters them; this guards direct
 * id/barcode lookups).
 */
export function canAccessFood(row: FoodItemRow, userId: string | null): boolean {
  if (row.source !== "user" && row.source !== "ai") return true;
  const owner = (row.metadata as Record<string, unknown>)?.owner_user_id;
  return userId != null && owner === userId;
}

/**
 * Create a user-entered custom food (manual nutrition entry, or an
 * AI-identified food the user confirmed). Runs with the service role;
 * the caller must have already authenticated the user.
 */
export async function createCustomFood(
  admin: SupabaseClient,
  userId: string,
  input: {
    name: string;
    brand?: string | null;
    barcode?: string | null;
    /** Per 100 g (or per serving_size/serving_unit below). */
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g?: number | null;
    sugar_g?: number | null;
    sodium_mg?: number | null;
    micronutrients?: Record<string, number>;
    serving_size?: number;
    serving_unit?: string;
    category?: string | null;
    source?: "user" | "ai";
    verification_status?: FoodItemRow["verification_status"];
    metadata_extra?: Record<string, unknown>;
  },
): Promise<FoodItemRow | null> {
  const source = input.source ?? "user";
  const payload = {
    name: input.name.trim(),
    normalized_name: normalizeFoodName(input.name),
    brand: input.brand ?? null,
    barcode: input.barcode ?? null,
    source,
    source_id: null,
    verification_status: input.verification_status ?? "user_reported",
    serving_size: input.serving_size ?? 100,
    serving_unit: input.serving_unit ?? "g",
    calories: input.calories,
    protein_g: input.protein_g,
    carbs_g: input.carbs_g,
    fat_g: input.fat_g,
    fiber_g: input.fiber_g ?? 0,
    sugar_g: input.sugar_g ?? 0,
    sodium_mg: input.sodium_mg ?? 0,
    micronutrients: input.micronutrients ?? {},
    metadata: {
      owner_user_id: userId,
      ...(input.category ? { category: input.category } : {}),
      ...(input.metadata_extra ?? {}),
    },
  };

  const { data, error } = await admin
    .from("food_items")
    .insert(payload)
    .select(FOOD_COLUMNS)
    .single();
  if (error) {
    console.error("[foods] createCustomFood failed:", error.message);
    return null;
  }
  return mapFoodRow(data as Raw);
}

/**
 * The user's own custom / AI-created foods (source user|ai, scoped by
 * metadata.owner_user_id). Safe on the RLS client: food_items select is
 * open to authenticated users and the owner filter narrows it further.
 */
export async function listCustomFoods(
  supabase: SupabaseClient,
  userId: string,
  limit = 50,
): Promise<FoodItemRow[]> {
  const { data, error } = await supabase
    .from("food_items")
    .select(FOOD_COLUMNS)
    .in("source", ["user", "ai"])
    .filter("metadata->>owner_user_id", "eq", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[foods] listCustomFoods failed:", error.message);
    return [];
  }
  return ((data ?? []) as Raw[]).map(mapFoodRow);
}
