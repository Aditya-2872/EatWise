/**
 * Client-safe response contracts for the AI endpoints (spec §25).
 * Mirrors what /api/ai/* routes return; no server-only imports here so
 * client components can type their fetches with these.
 */
import type { FoodImageAnalysis, Guidance, MealPlan } from "@/lib/ai/schemas";
import type { NutritionSnapshot } from "./nutrition";

/** One photo-identified item after deterministic database mapping. */
export interface MappedAiItem {
  candidate: string;
  /** Normalized quantity the engine will log (count units converted to grams). */
  quantity: number;
  /** Normalized unit: g, kg, ml, cup, tbsp, tsp. */
  unit: string;
  /** The AI's raw estimate before normalization (for correction tracking). */
  originalQuantity: number;
  originalUnit: string;
  /** "database" = verified food matched; "ai_estimate" = fallback per-100 g estimate. */
  basis: "database" | "ai_estimate";
  matched: boolean;
  foodId: string | null;
  foodName: string | null;
  foodBrand: string | null;
  /** DB verification_status, or "ai_estimated" for unmatched items. */
  verification: string | null;
  matchScore: number | null;
  /** Deterministic nutrition for this quantity; null when unloggable. */
  snapshot: NutritionSnapshot | null;
  /** Combined 0..1 confidence (identification × estimation penalties). */
  confidence: number;
  uncertaintyFactors: string[];
  /** Present when basis = "ai_estimate" — needed to create the custom food on confirm. */
  nutritionPer100g: { calories: number; protein_g: number; carbs_g: number; fat_g: number } | null;
  /** Set when a count → grams conversion was applied (and its assumed grams/unit). */
  gramsPerUnitUsed: number | null;
}

export interface AnalyzeFoodImageResponse {
  analysisId: string | null;
  needsClarification: boolean;
  clarification: { question: string; itemIndex: number | null } | null;
  /** Raw validated model output — round-tripped to /api/ai/clarify. */
  rawAnalysis: FoodImageAnalysis;
  items: MappedAiItem[];
  /** min(item confidences) — the headline "Confidence: 74%" number (spec §5). */
  overallConfidence: number;
  meta: { provider: string; model: string; latencyMs: number };
}

export interface GuidanceResponse {
  analysisId: string | null;
  guidance: Guidance;
  meta: { provider: string; model: string; latencyMs: number };
}

export interface MealPlanResponse {
  analysisId: string | null;
  plan: MealPlan;
  meta: { provider: string; model: string; latencyMs: number };
}

export interface ConfirmItemsResponse {
  results: {
    index: number;
    ok: boolean;
    logId?: string;
    error?: string;
  }[];
  loggedCount: number;
}
