import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { canAccessFood, searchInternalFoods } from "@/lib/foods/repository";
import { computeSnapshot } from "@/lib/logging/service";
import type { FoodItemRow } from "@/types/food";
import type { MappedAiItem } from "@/types/ai";
import type { AiFoodItem } from "./schemas";

/**
 * Deterministic mapping of AI-identified candidates to database foods
 * (spec §14 steps 8-10): the model identifies and estimates portions; THIS
 * module — pure typed server code — matches foods, converts units and lets
 * the nutrition engine compute every number. The AI's own per-100 g numbers
 * are used ONLY when no database match exists, and are always flagged
 * `basis: "ai_estimate"` with a confidence penalty.
 */

/** search_foods score floor for trusting a DB match (prefix≈60, alias≈85, exact=100). */
const DB_MATCH_MIN_SCORE = 50;

/** Confidence multiplier when nutrition falls back to the AI's own estimate. */
const AI_ESTIMATE_PENALTY = 0.8;

/** Assumed grams per count-unit when the model forgot grams_per_unit. */
const FALLBACK_GRAMS_PER_UNIT = 100;

const COUNT_UNITS = new Set(["count", "slice", "piece", "pcs", "pc", "unit", "serving", "whole"]);

function normalizeUnit(unit: string): string {
  const u = unit.trim().toLowerCase();
  if (COUNT_UNITS.has(u)) return "count";
  if (["gram", "grams", "gm", "gms", "gr"].includes(u)) return "g";
  if (["milliliter", "milliliters", "mls", "cc"].includes(u)) return "ml";
  if (["kilogram", "kilograms", "kgs"].includes(u)) return "kg";
  if (["cups"].includes(u)) return "cup";
  if (["tablespoon", "tablespoons", "tbs"].includes(u)) return "tbsp";
  if (["teaspoon", "teaspoons"].includes(u)) return "tsp";
  if (["litre", "liter", "liters", "litres", "l"].includes(u)) return "ml";
  return u.length > 0 && u.length <= 20 ? u : "g";
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** Synthetic 100 g reference row carrying the AI's fallback estimate. */
function syntheticRow(item: AiFoodItem, per100g: NonNullable<AiFoodItem["nutrition_per_100g"]>): FoodItemRow {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    name: item.candidate,
    normalized_name: item.candidate.toLowerCase(),
    brand: null,
    barcode: null,
    source: "ai",
    source_id: null,
    verification_status: "unverified",
    serving_size: 100,
    serving_unit: "g",
    calories: per100g.calories,
    protein_g: per100g.protein_g,
    carbs_g: per100g.carbs_g,
    fat_g: per100g.fat_g,
    fiber_g: 0,
    sugar_g: 0,
    sodium_mg: 0,
    micronutrients: {},
    metadata: { ai_estimated: true },
  };
}

/**
 * Map AI items → database foods + deterministic snapshots.
 * Count-units are converted to grams via the model's grams_per_unit (or a
 * flagged 100 g assumption), so logging always resolves through the engine.
 */
export async function mapAiItems(
  supabase: SupabaseClient,
  userId: string,
  items: AiFoodItem[],
): Promise<MappedAiItem[]> {
  const mapped: MappedAiItem[] = [];

  for (const item of items) {
    const originalUnit = item.unit.trim().toLowerCase();
    let unit = normalizeUnit(originalUnit);
    let quantity = item.estimated_quantity;
    const uncertaintyFactors = [...item.uncertainty_factors];
    let confidence = clamp01(item.confidence);
    let gramsPerUnitUsed: number | null = null;

    // Countable items → grams (deterministic multiplication of the AI estimate).
    if (unit === "count") {
      const gpu = item.grams_per_unit ?? null;
      if (gpu != null) {
        gramsPerUnitUsed = gpu;
        uncertaintyFactors.push("count_to_grams_estimate");
      } else {
        gramsPerUnitUsed = FALLBACK_GRAMS_PER_UNIT;
        uncertaintyFactors.push(`grams_per_unit_assumed_${FALLBACK_GRAMS_PER_UNIT}g`);
        confidence = clamp01(confidence * 0.85);
      }
      quantity = Math.round(quantity * gramsPerUnitUsed);
      unit = "g";
    }

    // 1) Try a verified database match (never let the model invent numbers here).
    const results = await searchInternalFoods(supabase, item.candidate, userId, 3);
    const best =
      results.length > 0 && results[0].score >= DB_MATCH_MIN_SCORE && canAccessFood(results[0], userId)
        ? results[0]
        : null;

    if (best) {
      const computed = computeSnapshot(best, quantity, unit);
      if (!("error" in computed)) {
        mapped.push({
          candidate: item.candidate,
          quantity,
          unit,
          originalQuantity: item.estimated_quantity,
          originalUnit,
          basis: "database",
          matched: true,
          foodId: best.id,
          foodName: best.name,
          foodBrand: best.brand,
          verification: best.verification_status,
          matchScore: best.score,
          snapshot: computed.snapshot,
          confidence,
          uncertaintyFactors,
          nutritionPer100g: null,
          gramsPerUnitUsed,
        });
        continue;
      }
      // Unit could not be resolved for the matched food (e.g. count without
      // unit weights) — fall through to the AI estimate path.
      if (!uncertaintyFactors.includes("db_unit_unresolved")) {
        uncertaintyFactors.push("db_unit_unresolved");
      }
    }

    // 2) Fallback: AI per-100 g estimate, scaled by the engine (flagged).
    const per100g = item.nutrition_per_100g ?? null;
    if (per100g) {
      const computed = computeSnapshot(syntheticRow(item, per100g), quantity, unit);
      const snapshot = "error" in computed ? null : computed.snapshot;
      mapped.push({
        candidate: item.candidate,
        quantity,
        unit,
        originalQuantity: item.estimated_quantity,
        originalUnit,
        basis: "ai_estimate",
        matched: false,
        foodId: null,
        foodName: item.candidate,
        foodBrand: null,
        verification: "ai_estimated",
        matchScore: best?.score ?? null,
        snapshot,
        confidence: clamp01(confidence * AI_ESTIMATE_PENALTY),
        uncertaintyFactors: [...uncertaintyFactors, "nutrition_ai_estimated"],
        nutritionPer100g: per100g,
        gramsPerUnitUsed,
      });
      continue;
    }

    // 3) No match AND no estimate — unloggable until the user edits it.
    mapped.push({
      candidate: item.candidate,
      quantity,
      unit,
      originalQuantity: item.estimated_quantity,
      originalUnit,
      basis: "ai_estimate",
      matched: false,
      foodId: null,
      foodName: item.candidate,
      foodBrand: null,
      verification: "ai_estimated",
      matchScore: best?.score ?? null,
      snapshot: null,
      confidence: clamp01(confidence * 0.5),
      uncertaintyFactors: [...uncertaintyFactors, "no_nutrition_data"],
      nutritionPer100g: null,
      gramsPerUnitUsed,
    });
  }

  return mapped;
}

/** Headline confidence = weakest item (spec §5 confidence-aware display). */
export function overallConfidence(items: MappedAiItem[]): number {
  if (items.length === 0) return 0;
  return Math.min(...items.map((i) => i.confidence));
}
