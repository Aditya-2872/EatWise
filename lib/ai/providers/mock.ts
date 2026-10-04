import "server-only";

import type { AiCallOptions, AiCallResult, AiProvider } from "../types";

/**
 * Deterministic mock provider — used ONLY when AI_PROVIDER=mock is explicitly
 * configured (spec §42: never fake integrations silently). Useful for tests
 * and for developing the UI without burning free-tier quota.
 */

const MOCK_LATENCY_MS = 150;

function mockOutput(task: AiCallOptions["task"], prompt: string): string {
  switch (task) {
    case "food_image":
      return JSON.stringify({
        items: [
          {
            candidate: "grilled chicken breast",
            estimated_quantity: 150,
            unit: "g",
            confidence: 0.93,
            uncertainty_factors: ["portion_size"],
            nutrition_per_100g: { calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 },
          },
          {
            candidate: "steamed rice",
            estimated_quantity: 150,
            unit: "g",
            confidence: 0.88,
            uncertainty_factors: [],
            nutrition_per_100g: { calories: 130, protein_g: 2.7, carbs_g: 28, fat_g: 0.3 },
          },
        ],
        needs_clarification: false,
        clarification: null,
      });
    case "clarification":
      return JSON.stringify({
        items: [
          {
            candidate: "dal tadka",
            estimated_quantity: 240,
            unit: "g",
            confidence: 0.9,
            uncertainty_factors: ["oil_quantity"],
            nutrition_per_100g: { calories: 110, protein_g: 6, carbs_g: 15, fat_g: 3 },
          },
        ],
        needs_clarification: false,
        clarification: null,
      });
    case "guidance":
      return JSON.stringify({
        answer:
          "[mock provider] This is deterministic test output — set AI_PROVIDER=gemini and AI_API_KEY for real guidance. Based on the provided context, focus on hitting your protein target at the next meal.",
        key_points: [
          "Mock guidance — no AI key configured",
          prompt.length > 0 ? "Context was passed through correctly" : "No context provided",
        ],
        suggestions: [
          {
            title: "Paneer bhurji with 2 rotis",
            reason: "Roughly 30 g protein to close today's protein gap",
            estimated_calories: 480,
            estimated_protein_g: 30,
          },
        ],
        needs_medical_advice: false,
      });
    case "meal_plan":
      return JSON.stringify({
        meals: [
          {
            meal_type: "dinner",
            name: "Light high-protein dinner",
            items: [
              {
                food_name: "grilled paneer tikka",
                quantity: 150,
                unit: "g",
                estimated_calories: 330,
                estimated_protein_g: 27,
              },
              {
                food_name: "mixed vegetable salad",
                quantity: 100,
                unit: "g",
                estimated_calories: 45,
                estimated_protein_g: 2,
              },
            ],
            note: "Mock plan — configure AI_PROVIDER=gemini for real suggestions.",
          },
        ],
        rationale: "[mock provider] Deterministic output for development and tests.",
      });
  }
}

export const mockProvider: AiProvider = {
  name: "mock",

  async generateJson(opts: AiCallOptions): Promise<AiCallResult> {
    await new Promise((r) => setTimeout(r, MOCK_LATENCY_MS));
    return {
      text: mockOutput(opts.task, opts.prompt),
      provider: "mock",
      model: "mock-1",
      tokensInput: null,
      tokensOutput: null,
      latencyMs: MOCK_LATENCY_MS,
    };
  },
};
