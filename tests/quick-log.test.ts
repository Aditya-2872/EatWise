import { describe, expect, it } from "vitest";

import { parseIntake } from "@/lib/logging/parse-intake";
import {
  computeSnapshot,
  describeFoodOptions,
  resolveGrams,
} from "@/lib/nutrition/resolve";
import type { FoodItemRow } from "@/types/food";

function food(partial: Partial<FoodItemRow> & { name: string }): FoodItemRow {
  const base: FoodItemRow = {
    id: "food_1",
    name: partial.name,
    normalized_name: partial.name.toLowerCase(),
    brand: null,
    barcode: null,
    source: "seed",
    source_id: null,
    verification_status: "verified",
    serving_size: 100,
    serving_unit: "g",
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    fiber_g: 0,
    sugar_g: 0,
    sodium_mg: 0,
    micronutrients: {},
    metadata: {},
  };
  return { ...base, ...partial };
}

describe("parseIntake", () => {
  it("parses the omelette case that motivated quick add", () => {
    expect(parseIntake("2 egg omelette")).toEqual([
      { qty: 2, unit: null, unitExplicit: false, name: "egg omelette", raw: "2 egg omelette" },
    ]);
    expect(parseIntake("2 eggs and 1 tbsp oil")).toEqual([
      { qty: 2, unit: null, unitExplicit: false, name: "eggs", raw: "2 eggs" },
      { qty: 1, unit: "tbsp", unitExplicit: true, name: "oil", raw: "1 tbsp oil" },
    ]);
  });

  it("handles Indian household units and separators", () => {
    expect(parseIntake("1 katori dal, 2 roti")).toEqual([
      { qty: 1, unit: "count", unitExplicit: true, name: "dal", raw: "1 katori dal" },
      { qty: 2, unit: null, unitExplicit: false, name: "roti", raw: "2 roti" },
    ]);
    expect(parseIntake("rice 250 g + 1 cup curd; 1 banana")).toHaveLength(3);
  });

  it("understands fractions and unicode", () => {
    expect(parseIntake("1/2 tsp salt")[0]).toMatchObject({ qty: 0.5, unit: "tsp" });
    expect(parseIntake("half cup milk")[0]).toMatchObject({ qty: 0.5, unit: "cup" });
    expect(parseIntake("½ apple")[0]).toMatchObject({ qty: 0.5, unit: null, name: "apple" });
  });

  it("handles trailing and glued metric quantities", () => {
    expect(parseIntake("rice 250 g")[0]).toMatchObject({ qty: 250, unit: "g", name: "rice" });
    expect(parseIntake("250g rice")[0]).toMatchObject({ qty: 250, unit: "g", name: "rice" });
  });

  it("consumes size adjectives", () => {
    expect(parseIntake("2 medium eggs")[0]).toMatchObject({ qty: 2, unit: null, name: "eggs" });
    expect(parseIntake("1 large banana")[0]).toMatchObject({ qty: 1, name: "banana" });
  });

  it("defaults to one item for bare names", () => {
    expect(parseIntake("apple")).toEqual([
      { qty: 1, unit: null, unitExplicit: false, name: "apple", raw: "apple" },
    ]);
  });

  it("never returns empty or filler names", () => {
    expect(parseIntake("2 of")).toEqual([]);
    expect(parseIntake("   ")).toEqual([]);
    expect(parseIntake("a")).toEqual([]);
    expect(parseIntake("250 g")).toEqual([]);
  });
});

describe("resolveGrams", () => {
  const roti = food({
    name: "Roti",
    metadata: { household_serving: { quantity: 40, unit: "g", label: "1 roti (medium)" } },
  });
  const oil = food({ name: "Oil", metadata: { category: "oil" } });

  it("uses household servings for count mode", () => {
    const r = resolveGrams(roti, 2, "count");
    expect(r).toMatchObject({ grams: 80 });
    expect(!("error" in r) && r.basis).toMatch(/2 × 1 roti/i);
  });

  it("falls back to average-weight table when no household serving exists", () => {
    const egg = food({ name: "Egg" });
    expect(resolveGrams(egg, 2, "count")).toMatchObject({ grams: 100 });
  });

  it("fails cleanly for unknown countables", () => {
    const mystery = food({ name: "Mystery dish" });
    expect(resolveGrams(mystery, 1, "count")).toMatchObject({ error: "COUNT_UNKNOWN" });
  });

  it("applies density for volume units", () => {
    expect(resolveGrams(oil, 1, "tbsp")).toMatchObject({ grams: 13.8 }); // 15 ml × 0.92
  });

  it("rejects invalid quantities", () => {
    expect(resolveGrams(roti, 0, "count")).toMatchObject({ error: "INVALID_QUANTITY" });
    expect(resolveGrams(roti, -2, "g")).toMatchObject({ error: "INVALID_QUANTITY" });
  });

  it("is pure — same input, same output", () => {
    expect(resolveGrams(roti, 3, "count")).toEqual(resolveGrams(roti, 3, "count"));
  });
});

describe("computeSnapshot", () => {
  const rice = food({
    name: "Rice, cooked",
    calories: 130,
    protein_g: 2.7,
    carbs_g: 28,
    fat_g: 0.3,
    metadata: { household_serving: { quantity: 150, unit: "g", label: "1 katori" } },
  });

  it("scales the reference serving to the resolved grams", () => {
    const r = computeSnapshot(rice, 2, "count"); // 2 katori = 300 g = 3× per-100g
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.resolution.grams).toBe(300);
    expect(r.snapshot).toMatchObject({ calories: 390, proteinG: 8.1, carbsG: 84, fatG: 0.9 });
  });

  it("surfaces resolution failures", () => {
    const r = computeSnapshot(rice, 0, "count");
    expect("error" in r && r.error.code).toBe("INVALID_QUANTITY");
  });
});

describe("describeFoodOptions", () => {
  it("offers count for items with household servings", () => {
    const roti = food({
      name: "Roti",
      metadata: { household_serving: { quantity: 40, unit: "g", label: "1 roti" } },
    });
    const o = describeFoodOptions(roti);
    expect(o.modes).toContain("count");
    expect(o.defaultMode).toBe("count");
    expect(o.countLabel).toMatch(/roti/i);
    expect(o.gramsPerCount).toBe(40);
    expect(o.gramsPerServing).toBe(100);
  });

  it("offers weight for everything, count for nothing unweighable", () => {
    const o = describeFoodOptions(food({ name: "Anything" }));
    expect(o.modes).toContain("weight");
    expect(o.modes).not.toContain("count");
    expect(o.modes).not.toContain("volume");
    expect(o.gramsPerCount).toBeNull();
  });

  it("offers confident volume when the reference serving is volumetric", () => {
    const milk = food({ name: "Milk", serving_size: 200, serving_unit: "ml" });
    const o = describeFoodOptions(milk);
    expect(o.modes).toEqual(expect.arrayContaining(["volume", "weight"]));
    expect(o.volumeIsConfident).toBe(true);
    // 200 ml milk ≈ 206 g via liquid density (1.03)
    expect(o.gramsPerServing).toBeGreaterThan(150);
    expect(o.gramsPerServing).toBeLessThan(260);
  });
});
