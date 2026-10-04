/**
 * Pure quantity → grams → snapshot resolution (spec §18).
 *
 * This module is intentionally client-safe (no server-only imports): the
 * log dialog and Quick Add use the EXACT same math as the server, so the
 * preview the user sees is the value that gets stored. The server
 * (`lib/logging/service.ts`) re-exports these symbols as the single source
 * of truth — never fork the arithmetic.
 */

import type { FoodItemRow } from "@/types/food";
import type { FoodItem, NutritionSnapshot } from "@/types/nutrition";
import {
  foodReferenceSnapshot,
  scaleSnapshot,
} from "@/lib/nutrition/calculations";
import {
  MASS_TO_GRAMS,
  VOLUME_TO_ML,
  normalizeUnit,
  toGrams,
  unitKind,
} from "@/lib/nutrition/units";
import {
  estimateDensity,
  estimateUnitWeight,
  hasKnownDensity,
} from "@/lib/nutrition/density";

export type LogErrorCode =
  | "FOOD_NOT_FOUND"
  | "INVALID_QUANTITY"
  | "UNKNOWN_UNIT"
  | "COUNT_UNKNOWN"
  | "UNSUPPORTED_EDIT"
  | "DB_ERROR";

export interface LogFailure {
  ok: false;
  code: LogErrorCode;
  message: string;
}

/* ------------------------------------------------------------------ */
/* Quantity → grams resolution (deterministic, never guessed silently) */
/* ------------------------------------------------------------------ */

export interface GramsResolution {
  grams: number;
  /** Human-readable explanation of a non-obvious conversion. */
  basis?: string;
  density?: number;
}

function rowCategory(row: FoodItemRow): string | null {
  return typeof row.metadata?.category === "string" ? row.metadata.category : null;
}

export function resolveGrams(
  row: FoodItemRow,
  quantity: number,
  unitRaw: string,
): GramsResolution | { error: LogErrorCode; message: string } {
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100_000) {
    return { error: "INVALID_QUANTITY", message: "Enter a quantity greater than 0." };
  }
  const unit = normalizeUnit(unitRaw);
  const density = estimateDensity(row.name, rowCategory(row));
  const kind = unitKind(unit);

  if (kind === "mass") {
    return { grams: quantity * MASS_TO_GRAMS[unit] };
  }
  if (kind === "volume") {
    return {
      grams: quantity * VOLUME_TO_ML[unit] * density,
      basis: `volume converted using estimated density ${density} g/ml`,
      density,
    };
  }
  if (kind === "count") {
    // 1. Household serving from master data, e.g. "1 katori (150 g)".
    const hs = row.metadata?.household_serving;
    if (hs && Number(hs.quantity) > 0 && hs.unit) {
      const perServing = toGrams(Number(hs.quantity), hs.unit, density);
      if (perServing != null) {
        return {
          grams: quantity * perServing,
          basis: `${quantity} × ${hs.label ?? `${hs.quantity} ${hs.unit}`}`,
          density,
        };
      }
    }
    // 2. Average weight table ("1 egg ≈ 50 g").
    const uw = estimateUnitWeight(row.name);
    if (uw) {
      return { grams: quantity * uw.gramsPerUnit, basis: `1 count ≈ ${uw.label}` };
    }
    return {
      error: "COUNT_UNKNOWN",
      message: `We don't know the weight of one "${row.name}". Please log it in grams (or ml).`,
    };
  }
  return {
    error: "UNKNOWN_UNIT",
    message: `Unsupported unit "${unitRaw}". Use g, kg, ml, cup, tbsp, tsp or count.`,
  };
}

function rowToFoodItem(row: FoodItemRow): FoodItem {
  return {
    id: row.id,
    name: row.name,
    normalizedName: row.normalized_name,
    brand: row.brand,
    barcode: row.barcode,
    source: row.source,
    sourceId: row.source_id,
    verificationStatus: row.verification_status,
    servingSize: row.serving_size,
    servingUnit: row.serving_unit,
    calories: row.calories,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
    fiberG: row.fiber_g,
    sugarG: row.sugar_g,
    sodiumMg: row.sodium_mg,
    micronutrients: row.micronutrients,
    metadata: row.metadata,
  };
}

/** Frozen snapshot for a logged quantity of a master food row. */
export function computeSnapshot(
  row: FoodItemRow,
  quantity: number,
  unitRaw: string,
): { snapshot: NutritionSnapshot; resolution: GramsResolution } | { error: LogFailure } {
  const resolved = resolveGrams(row, quantity, unitRaw);
  if ("error" in resolved) {
    return { error: { ok: false, code: resolved.error, message: resolved.message } };
  }

  const density = resolved.density ?? estimateDensity(row.name, rowCategory(row));
  const refGrams = servingGrams(row, density);
  if (refGrams == null) {
    return {
      error: {
        ok: false,
        code: "UNKNOWN_UNIT",
        message: `Reference serving of "${row.name}" (${row.serving_size} ${row.serving_unit}) cannot be converted to grams.`,
      },
    };
  }

  const snapshot = scaleSnapshot(
    foodReferenceSnapshot(rowToFoodItem(row)),
    resolved.grams / refGrams,
  );
  return { snapshot, resolution: resolved };
}

/** Reference serving of a food row expressed in grams (null if not convertible). */
export function servingGrams(row: FoodItemRow, density?: number): number | null {
  const d = density ?? estimateDensity(row.name, rowCategory(row));
  const refUnit = normalizeUnit(row.serving_unit);
  let grams: number | null;
  if (unitKind(refUnit) === "mass") {
    grams = row.serving_size * MASS_TO_GRAMS[refUnit];
  } else {
    grams = toGrams(row.serving_size, refUnit, d);
  }
  if (!grams || !Number.isFinite(grams) || grams <= 0) return null;
  return grams;
}

/* ------------------------------------------------------------------ */
/* UI helpers: how can this food be measured?                          */
/* ------------------------------------------------------------------ */

export type QuantityMode = "count" | "volume" | "weight";

export interface FoodQuantityOptions {
  /** Available input modes, best-first. */
  modes: QuantityMode[];
  defaultMode: QuantityMode;
  /** "1 medium roti", "1 katori", "1 egg"… — null when count is unavailable. */
  countLabel: string | null;
  /** Grams per 1 count unit (household serving or average-weight table). */
  gramsPerCount: number | null;
  /** Grams in the reference serving (for the "1 serving" chip). */
  gramsPerServing: number | null;
  density: number;
  /** True when volume→mass uses a matched density (not the water default). */
  volumeIsConfident: boolean;
}

/**
 * Describe how a food can realistically be measured. Drives the log dialog:
 * only modes that can resolve to grams are offered, so the user can never
 * pick "count" for a food we cannot weigh.
 */
export function describeFoodOptions(row: FoodItemRow): FoodQuantityOptions {
  const density = estimateDensity(row.name, rowCategory(row));
  const modes: QuantityMode[] = [];

  // Count: household serving (exact, from master data) or average-weight table.
  let gramsPerCount: number | null = null;
  let countLabel: string | null = null;
  const hs = row.metadata?.household_serving;
  if (hs && Number(hs.quantity) > 0 && hs.unit) {
    const per = toGrams(Number(hs.quantity), String(hs.unit), density);
    if (per != null) {
      gramsPerCount = per;
      countLabel = String(hs.label ?? `${hs.quantity} ${hs.unit}`);
    }
  }
  if (gramsPerCount == null) {
    const uw = estimateUnitWeight(row.name);
    if (uw) {
      gramsPerCount = uw.gramsPerUnit;
      countLabel = uw.label;
    }
  }
  if (gramsPerCount != null) modes.push("count");

  // Volume: worth offering for liquids/powders, or when the serving itself is
  // a volume (milk in ml, ghee per tsp).
  const servingIsVolume = unitKind(normalizeUnit(row.serving_unit)) === "volume";
  const volumeIsConfident = servingIsVolume || hasKnownDensity(row.name, rowCategory(row));
  if (volumeIsConfident) modes.push("volume");

  modes.push("weight");

  const defaultMode: QuantityMode = modes.includes("count")
    ? "count"
    : servingIsVolume
      ? "volume"
      : "weight";

  return {
    modes,
    defaultMode,
    countLabel,
    gramsPerCount,
    gramsPerServing: servingGrams(row, density),
    density,
    volumeIsConfident,
  };
}
