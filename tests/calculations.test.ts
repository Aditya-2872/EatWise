import { describe, expect, it } from "vitest";

import {
  computeLogNutrition,
  emptySnapshot,
  macroCalorieSplit,
  remaining,
  scaleSnapshot,
  sumSnapshots,
} from "@/lib/nutrition/calculations";
import type { FoodItem, NutritionSnapshot } from "@/types/nutrition";

/** A per-100 g food with easy-to-check numbers. */
function makeFood(overrides: Partial<FoodItem> = {}): FoodItem {
  return {
    id: "f1",
    name: "Test food",
    normalizedName: "test food",
    brand: null,
    barcode: null,
    source: "seed",
    sourceId: null,
    verificationStatus: "verified",
    servingSize: 100,
    servingUnit: "g",
    calories: 200,
    proteinG: 10,
    carbsG: 20,
    fatG: 8,
    fiberG: 2,
    sugarG: 4,
    sodiumMg: 100,
    micronutrients: {},
    metadata: {},
    ...overrides,
  };
}

function snap(overrides: Partial<NutritionSnapshot> = {}): NutritionSnapshot {
  return { ...emptySnapshot(), ...overrides };
}

describe("scaleSnapshot", () => {
  it("scales and rounds each field", () => {
    const s = scaleSnapshot(snap({ calories: 201, proteinG: 10.44, sodiumMg: 99.6 }), 2);
    expect(s.calories).toBe(402);
    expect(s.proteinG).toBe(20.9); // 20.88 → 1 decimal
    expect(s.sodiumMg).toBe(199); // 199.2 → integer
  });

  it("scales micronutrients when present", () => {
    const s = scaleSnapshot(snap({ micronutrients: { calcium_mg: 30 } }), 0.5);
    expect(s.micronutrients).toEqual({ calcium_mg: 15 });
  });

  it("throws on invalid factors", () => {
    expect(() => scaleSnapshot(snap({}), 0)).toThrow();
    expect(() => scaleSnapshot(snap({}), -1)).toThrow();
    expect(() => scaleSnapshot(snap({}), NaN)).toThrow();
  });
});

describe("computeLogNutrition", () => {
  it("halves a per-100 g food at 50 g", () => {
    const s = computeLogNutrition(makeFood(), 50, "g");
    expect(s).not.toBeNull();
    expect(s!.calories).toBe(100);
    expect(s!.proteinG).toBe(5);
    expect(s!.carbsG).toBe(10);
    expect(s!.fatG).toBe(4);
    expect(s!.sodiumMg).toBe(50);
  });

  it("converts compatible units (kg → per-100 g)", () => {
    const s = computeLogNutrition(makeFood(), 0.5, "kg");
    expect(s!.calories).toBe(1000);
  });

  it("accepts unit aliases", () => {
    const s = computeLogNutrition(makeFood(), 50, "grams");
    expect(s!.calories).toBe(100);
  });

  it("bridges volume → mass only with explicit density", () => {
    // 1 cup = 240 ml; density 0.9 g/ml → 216 g → factor 2.16
    expect(computeLogNutrition(makeFood(), 1, "cup")).toBeNull();
    const s = computeLogNutrition(makeFood(), 1, "cup", 0.9);
    expect(s!.calories).toBe(Math.round(200 * 2.16)); // 432
  });

  it("handles volume reference servings", () => {
    const food = makeFood({ servingSize: 100, servingUnit: "ml", calories: 50 });
    const s = computeLogNutrition(food, 1, "cup"); // 240 ml → ×2.4
    expect(s!.calories).toBe(120);
  });

  it("supports foods whose reference serving is itself a count unit", () => {
    // e.g. "1 egg (50 g)" stored as servingSize 1, servingUnit "unit"
    const egg = makeFood({ servingSize: 1, servingUnit: "unit", calories: 78, proteinG: 6.3 });
    const s = computeLogNutrition(egg, 2, "unit");
    expect(s!.calories).toBe(156);
    expect(s!.proteinG).toBe(12.6);
    // count aliases work too ("piece" → "unit")
    expect(computeLogNutrition(egg, 2, "pieces")!.calories).toBe(156);
    // count unit against a mass-based reference is rejected (no silent guess)
    expect(computeLogNutrition(makeFood(), 2, "unit")).toBeNull();
  });

  it("rejects invalid quantities and serving sizes", () => {
    expect(computeLogNutrition(makeFood(), 0, "g")).toBeNull();
    expect(computeLogNutrition(makeFood(), -10, "g")).toBeNull();
    expect(computeLogNutrition(makeFood({ servingSize: 0 }), 10, "g")).toBeNull();
  });
});

describe("sumSnapshots", () => {
  it("sums macros and merges micronutrients", () => {
    const total = sumSnapshots([
      snap({ calories: 100, proteinG: 10, micronutrients: { calcium_mg: 20 } }),
      snap({ calories: 250, proteinG: 5.25, micronutrients: { calcium_mg: 10, iron_mg: 2 } }),
    ]);
    expect(total.calories).toBe(350);
    expect(total.proteinG).toBe(15.3); // 15.25 → 1 decimal
    expect(total.micronutrients).toEqual({ calcium_mg: 30, iron_mg: 2 });
  });

  it("returns zeros for an empty list", () => {
    expect(sumSnapshots([])).toEqual(emptySnapshot());
  });
});

describe("remaining", () => {
  it("subtracts and can go negative", () => {
    expect(remaining(2000, 1500.25)).toBe(499.8);
    expect(remaining(2000, 2100)).toBe(-100);
  });
});

describe("macroCalorieSplit", () => {
  it("uses 4/4/9 Atwater factors", () => {
    // p 50×4=200, c 100×4=400, f 50×9=450 → total 1050
    const split = macroCalorieSplit(snap({ proteinG: 50, carbsG: 100, fatG: 50 }));
    expect(split.totalKcal).toBe(1050);
    expect(split.proteinPct).toBe(19);
    expect(split.carbsPct).toBe(38);
    expect(split.fatPct).toBe(43);
    expect(split.proteinPct + split.carbsPct + split.fatPct).toBe(100);
  });

  it("returns zeros when no macros", () => {
    expect(macroCalorieSplit(emptySnapshot())).toEqual({
      proteinPct: 0,
      carbsPct: 0,
      fatPct: 0,
      totalKcal: 0,
    });
  });
});
