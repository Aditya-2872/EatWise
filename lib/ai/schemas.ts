/**
 * Zod schemas for every AI workflow (spec §26 "Structured output").
 *
 * This module is isomorphic (no server-only): API routes validate model
 * output with it, and client components import the inferred types to render
 * validated results. The LLM never computes nutrition for logged food —
 * these schemas only carry identification, portion estimates, and (as a
 * last-resort fallback for unmatched foods) rough per-100 g estimates that
 * are always flagged as unverified.
 */
import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Food image analysis (spec §14)                                      */
/* ------------------------------------------------------------------ */

export const AI_UNITS = ["g", "ml", "count", "cup", "tbsp", "tsp", "kg", "slice", "piece"] as const;

export const aiNutritionPer100gSchema = z.object({
  calories: z.number().min(0).max(1500),
  protein_g: z.number().min(0).max(100),
  carbs_g: z.number().min(0).max(100),
  fat_g: z.number().min(0).max(100),
});

export const aiFoodItemSchema = z.object({
  /** Identified food/dish name, e.g. "dal tadka". */
  candidate: z.string().min(1).max(120),
  estimated_quantity: z.number().positive().max(5000),
  unit: z.string().min(1).max(20),
  /**
   * For countable units (count/slice/piece): estimated grams of ONE unit,
   * so the deterministic mapper can convert count → grams transparently.
   */
  grams_per_unit: z.number().positive().max(5000).nullish(),
  /** Model's self-reported identification confidence, 0..1. */
  confidence: z.number().min(0).max(1),
  uncertainty_factors: z.array(z.string().max(60)).max(6).catch([]),
  /**
   * Rough per-100 g estimate — ONLY used when the deterministic mapper finds
   * no database match. Ignored whenever a verified DB food matches.
   */
  nutrition_per_100g: aiNutritionPer100gSchema.nullish(),
});

export const foodImageAnalysisSchema = z.object({
  items: z.array(aiFoodItemSchema).min(1).max(10),
  needs_clarification: z.boolean().catch(false),
  clarification: z
    .object({
      question: z.string().min(1).max(300),
      /** Index into `items` the question refers to, when applicable. */
      item_index: z.number().int().min(0).max(9).nullish(),
    })
    .nullish(),
});

export type AiFoodItem = z.infer<typeof aiFoodItemSchema>;
export type FoodImageAnalysis = z.infer<typeof foodImageAnalysisSchema>;

/* ------------------------------------------------------------------ */
/* Guidance coach (spec §19)                                           */
/* ------------------------------------------------------------------ */

export const guidanceSchema = z.object({
  answer: z.string().min(1).max(2500),
  key_points: z.array(z.string().min(1).max(220)).max(5).catch([]),
  suggestions: z
    .array(
      z.object({
        title: z.string().min(1).max(120),
        reason: z.string().min(1).max(300),
        /** Illustrative estimate only — never written to logs unconfirmed. */
        estimated_calories: z.number().int().min(0).max(5000).nullish(),
        estimated_protein_g: z.number().min(0).max(500).nullish(),
      }),
    )
    .max(4)
    .catch([]),
  /** True when the question touched medical territory and we advised a professional. */
  needs_medical_advice: z.boolean().catch(false),
});

export type Guidance = z.infer<typeof guidanceSchema>;

/* ------------------------------------------------------------------ */
/* Meal plan (next-meal intelligence, spec §5/§25)                     */
/* ------------------------------------------------------------------ */

export const MEAL_PLAN_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;

export const mealPlanSchema = z.object({
  meals: z
    .array(
      z.object({
        meal_type: z.enum(MEAL_PLAN_TYPES),
        name: z.string().min(1).max(120),
        items: z
          .array(
            z.object({
              food_name: z.string().min(1).max(120),
              quantity: z.number().positive().max(2000),
              unit: z.string().min(1).max(20),
              estimated_calories: z.number().min(0).max(3000),
              estimated_protein_g: z.number().min(0).max(300),
            }),
          )
          .min(1)
          .max(6),
        note: z.string().max(300).nullish(),
      }),
    )
    .min(1)
    .max(4),
  rationale: z.string().min(1).max(600),
});

export type MealPlan = z.infer<typeof mealPlanSchema>;

/* ------------------------------------------------------------------ */
/* API request schemas (validated at the route boundary)               */
/* ------------------------------------------------------------------ */

export const analyzeImageRequestSchema = z.object({
  /** Base64 image bytes (client compresses first). Max ~6 MB decoded. */
  imageBase64: z
    .string()
    .min(100)
    .max(8_400_000)
    .transform((s) => (s.includes(",") ? s.slice(s.indexOf(",") + 1) : s)),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack", "custom"]).optional(),
  /** Optional user hint, e.g. "two rotis and dal". */
  hints: z.string().trim().max(300).optional(),
});

export const clarifyRequestSchema = z.object({
  analysisId: z.string().uuid().nullish(),
  analysis: foodImageAnalysisSchema,
  question: z.string().min(1).max(300),
  answer: z.string().trim().min(1).max(300),
});

export const guidanceRequestSchema = z.object({
  question: z.string().trim().min(3).max(400),
});

export const mealPlanRequestSchema = z.object({
  /** Which meals to plan; defaults to the deterministic next meals of today. */
  mealTypes: z.array(z.enum(MEAL_PLAN_TYPES)).min(1).max(3).optional(),
});

export const confirmItemsRequestSchema = z.object({
  analysisId: z.string().uuid().nullish(),
  items: z
    .array(
      z.object({
        candidate: z.string().min(1).max(120),
        quantity: z.number().positive().max(5000),
        unit: z.string().min(1).max(20),
        mealType: z.enum(["breakfast", "lunch", "dinner", "snack", "custom"]),
        confidence: z.number().min(0).max(1).nullish(),
        /** Set when the deterministic mapper matched a database food. */
        foodId: z.string().uuid().nullish(),
        /** AI per-100 g fallback (only honored when foodId is null). */
        nutritionPer100g: aiNutritionPer100gSchema.nullish(),
        uncertaintyFactors: z.array(z.string().max(60)).max(6).optional(),
        /** AI's original quantity — when present and different, we store a correction. */
        originalQuantity: z.number().positive().max(5000).nullish(),
      }),
    )
    .min(1)
    .max(10),
});

export type ConfirmItemsRequest = z.infer<typeof confirmItemsRequestSchema>;
