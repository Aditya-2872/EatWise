import { describe, expect, it } from "vitest";

import {
  analyzeImageRequestSchema,
  confirmItemsRequestSchema,
  foodImageAnalysisSchema,
  guidanceSchema,
  mealPlanSchema,
} from "@/lib/ai/schemas";

const validItem = {
  candidate: "dal tadka",
  estimated_quantity: 250,
  unit: "g",
  confidence: 0.86,
};

describe("foodImageAnalysisSchema", () => {
  it("accepts a minimal valid analysis", () => {
    const parsed = foodImageAnalysisSchema.parse({ items: [validItem] });
    expect(parsed.items).toHaveLength(1);
    expect(parsed.needs_clarification).toBe(false);
    expect(parsed.items[0].uncertainty_factors).toEqual([]);
  });

  it("self-heals malformed optional fields instead of failing", () => {
    const parsed = foodImageAnalysisSchema.parse({
      items: [{ ...validItem, uncertainty_factors: "portion hidden" }],
      needs_clarification: "yes",
    });
    expect(parsed.items[0].uncertainty_factors).toEqual([]);
    expect(parsed.needs_clarification).toBe(false);
  });

  it("rejects out-of-range confidence and empty item lists", () => {
    expect(foodImageAnalysisSchema.safeParse({ items: [{ ...validItem, confidence: 1.5 }] }).success).toBe(false);
    expect(foodImageAnalysisSchema.safeParse({ items: [] }).success).toBe(false);
    expect(foodImageAnalysisSchema.safeParse({ items: Array(11).fill(validItem) }).success).toBe(false);
  });

  it("rejects implausible per-100 g estimates", () => {
    expect(
      foodImageAnalysisSchema.safeParse({
        items: [{ ...validItem, nutrition_per_100g: { calories: 5000, protein_g: 10, carbs_g: 10, fat_g: 10 } }],
      }).success,
    ).toBe(false);
  });
});

describe("guidanceSchema", () => {
  it("accepts a full valid answer", () => {
    const parsed = guidanceSchema.parse({
      answer: "Add a protein source to your dinner.",
      key_points: ["Protein target 144 g"],
      suggestions: [{ title: "Paneer 100 g", reason: "~30 g protein", estimated_calories: 321, estimated_protein_g: 30.1 }],
      needs_medical_advice: false,
    });
    expect(parsed.suggestions).toHaveLength(1);
  });

  it("catches garbage in optional arrays and booleans", () => {
    const parsed = guidanceSchema.parse({
      answer: "ok",
      key_points: 42,
      suggestions: [{ title: "" }],
      needs_medical_advice: "maybe",
    });
    expect(parsed.key_points).toEqual([]);
    expect(parsed.suggestions).toEqual([]);
    expect(parsed.needs_medical_advice).toBe(false);
  });

  it("requires a non-empty answer", () => {
    expect(guidanceSchema.safeParse({ answer: "" }).success).toBe(false);
  });
});

describe("mealPlanSchema", () => {
  const validMeal = {
    meal_type: "dinner",
    name: "Light dinner",
    items: [{ food_name: "Grilled paneer", quantity: 120, unit: "g", estimated_calories: 321, estimated_protein_g: 30 }],
    rationale: "Protein is 60 g below target.",
  };

  it("accepts a valid plan", () => {
    expect(mealPlanSchema.parse({ meals: [validMeal], rationale: validMeal.rationale }).meals).toHaveLength(1);
  });

  it("rejects unknown meal types and empty item lists", () => {
    expect(mealPlanSchema.safeParse({ meals: [{ ...validMeal, meal_type: "brunch" }], rationale: "x" }).success).toBe(false);
    expect(mealPlanSchema.safeParse({ meals: [{ ...validMeal, items: [] }], rationale: "x" }).success).toBe(false);
  });
});

describe("analyzeImageRequestSchema", () => {
  const b64 = "A".repeat(200);

  it("strips a data URL prefix", () => {
    const parsed = analyzeImageRequestSchema.parse({
      imageBase64: `data:image/jpeg;base64,${b64}`,
      mimeType: "image/jpeg",
    });
    expect(parsed.imageBase64).toBe(b64);
  });

  it("rejects unsupported mime types and tiny payloads", () => {
    expect(analyzeImageRequestSchema.safeParse({ imageBase64: b64, mimeType: "image/gif" }).success).toBe(false);
    expect(analyzeImageRequestSchema.safeParse({ imageBase64: "short", mimeType: "image/jpeg" }).success).toBe(false);
  });
});

describe("confirmItemsRequestSchema", () => {
  const uuid = "3f2b8c1e-9d4a-4e7b-8f21-6c0d5a9b1e22";

  it("accepts confirmed items with and without a DB match", () => {
    const parsed = confirmItemsRequestSchema.parse({
      analysisId: uuid,
      items: [
        { candidate: "apple", quantity: 150, unit: "g", mealType: "snack", confidence: 0.9, foodId: uuid },
        {
          candidate: "mystery dish",
          quantity: 1,
          unit: "count",
          mealType: "lunch",
          nutritionPer100g: { calories: 180, protein_g: 7, carbs_g: 20, fat_g: 8 },
          originalQuantity: 1.5,
        },
      ],
    });
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[1].foodId).toBeUndefined();
  });

  it("rejects empty lists, negative quantities and bad UUIDs", () => {
    expect(confirmItemsRequestSchema.safeParse({ items: [] }).success).toBe(false);
    expect(
      confirmItemsRequestSchema.safeParse({ items: [{ candidate: "x", quantity: -1, unit: "g", mealType: "lunch" }] })
        .success,
    ).toBe(false);
    expect(
      confirmItemsRequestSchema.safeParse({
        items: [{ candidate: "x", quantity: 1, unit: "g", mealType: "lunch", foodId: "not-a-uuid" }],
      }).success,
    ).toBe(false);
  });
});
