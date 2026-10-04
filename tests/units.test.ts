import { describe, expect, it } from "vitest";

import {
  convertQuantity,
  kgToLb,
  lbToKg,
  normalizeUnit,
  toGrams,
  unitKind,
} from "@/lib/nutrition/units";

describe("normalizeUnit", () => {
  it("maps aliases to canonical units", () => {
    expect(normalizeUnit("grams")).toBe("g");
    expect(normalizeUnit("Gram")).toBe("g");
    expect(normalizeUnit("ounces")).toBe("oz");
    expect(normalizeUnit("teaspoon")).toBe("tsp");
    expect(normalizeUnit("cups")).toBe("cup");
    expect(normalizeUnit("serving")).toBe("unit");
    expect(normalizeUnit("pieces")).toBe("unit");
  });

  it("passes unknown units through lowercased", () => {
    expect(normalizeUnit(" BLAH ")).toBe("blah");
  });
});

describe("unitKind", () => {
  it("classifies mass, volume, count and unknown", () => {
    expect(unitKind("kg")).toBe("mass");
    expect(unitKind("ounce")).toBe("mass");
    expect(unitKind("cup")).toBe("volume");
    expect(unitKind("ml")).toBe("volume");
    expect(unitKind("serving")).toBe("count");
    expect(unitKind("blah")).toBeNull();
  });
});

describe("convertQuantity", () => {
  it("converts within mass", () => {
    expect(convertQuantity(1, "kg", "g")).toBe(1000);
    expect(convertQuantity(500, "g", "kg")).toBe(0.5);
    expect(convertQuantity(1, "lb", "g")).toBeCloseTo(453.59237, 3);
    expect(convertQuantity(1, "oz", "g")).toBeCloseTo(28.3495, 3);
  });

  it("converts within volume", () => {
    expect(convertQuantity(1, "cup", "ml")).toBe(240);
    expect(convertQuantity(1, "tbsp", "tsp")).toBe(3);
    expect(convertQuantity(1, "l", "ml")).toBe(1000);
  });

  it("returns the same quantity for identical units", () => {
    expect(convertQuantity(2.5, "g", "g")).toBe(2.5);
    expect(convertQuantity(2, "grams", "g")).toBe(2);
  });

  it("requires an explicit density to bridge mass <-> volume", () => {
    expect(convertQuantity(1, "cup", "g")).toBeNull();
    expect(convertQuantity(240, "ml", "g", 1)).toBe(240);
    expect(convertQuantity(250, "ml", "g", 0.8)).toBeCloseTo(200, 6);
    expect(convertQuantity(200, "g", "ml", 0.8)).toBeCloseTo(250, 6);
    expect(convertQuantity(100, "g", "cup", 1)).toBeCloseTo(100 / 240, 6);
  });

  it("never converts count units", () => {
    expect(convertQuantity(1, "unit", "g")).toBeNull();
    expect(convertQuantity(1, "g", "piece")).toBeNull();
    expect(convertQuantity(1, "unit", "unit")).toBe(1);
  });

  it("rejects unknown units and invalid quantities", () => {
    expect(convertQuantity(1, "g", "blah")).toBeNull();
    expect(convertQuantity(0, "g", "kg")).toBeNull();
    expect(convertQuantity(-5, "g", "kg")).toBeNull();
    expect(convertQuantity(NaN, "g", "kg")).toBeNull();
  });
});

describe("toGrams", () => {
  it("handles mass directly and volume via density", () => {
    expect(toGrams(2, "kg")).toBe(2000);
    expect(toGrams(1, "cup")).toBe(240); // default density 1
    expect(toGrams(1, "cup", 0.5)).toBe(120);
    expect(toGrams(1, "unit")).toBeNull();
  });
});

describe("kg/lb helpers", () => {
  it("round-trips", () => {
    expect(kgToLb(1)).toBeCloseTo(2.20462, 4);
    expect(lbToKg(kgToLb(82.5))).toBeCloseTo(82.5, 9);
  });
});
