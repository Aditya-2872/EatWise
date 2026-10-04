import { describe, expect, it } from "vitest";

import { bmrMifflinStJeor, calculateTargets, tdee } from "@/lib/nutrition/targets";
import type { TargetProfile } from "@/types/nutrition";

function profile(overrides: Partial<TargetProfile> = {}): TargetProfile {
  return {
    sex: "male",
    ageYears: 30,
    heightCm: 180,
    weightKg: 80,
    activityLevel: "sedentary",
    goalType: "maintain",
    ...overrides,
  };
}

describe("bmrMifflinStJeor", () => {
  it("matches hand-computed values", () => {
    // male: 10×80 + 6.25×180 − 5×30 + 5 = 1780
    expect(bmrMifflinStJeor("male", 80, 180, 30)).toBeCloseTo(1780, 6);
    // female 60/165/25: 600 + 1031.25 − 125 − 161 = 1345.25
    expect(bmrMifflinStJeor("female", 60, 165, 25)).toBeCloseTo(1345.25, 6);
    // other: base + (5 − 161)/2 = base − 78
    expect(bmrMifflinStJeor("other", 80, 180, 30)).toBeCloseTo(1697, 6);
  });

  it("applies activity factors", () => {
    expect(tdee(1000, "sedentary")).toBeCloseTo(1200, 6);
    expect(tdee(1000, "light")).toBeCloseTo(1375, 6);
    expect(tdee(1000, "moderate")).toBeCloseTo(1550, 6);
    expect(tdee(1000, "active")).toBeCloseTo(1725, 6);
    expect(tdee(1000, "very_active")).toBeCloseTo(1900, 6);
  });
});

describe("calculateTargets", () => {
  it("computes a weight-loss target with 25 kcal rounding", () => {
    // BMR 1780, TDEE 2136, −500 → 1636 → nearest 25 = 1625
    const t = calculateTargets(profile({ goalType: "lose_weight" }));
    expect(t.bmr).toBe(1780);
    expect(t.tdee).toBe(2136);
    expect(t.calorieTarget).toBe(1625);
    // protein 1.8 g/kg × 80 = 144
    expect(t.proteinTargetG).toBe(144);
    // fat 25 % of 1625 / 9 = 45.1 → 45; carbs (1625 − 576 − 405)/4 = 161
    expect(t.fatTargetG).toBe(45);
    expect(t.carbTargetG).toBe(161);
    expect(t.explanation).toContain("1625 kcal/day");
  });

  it("never targets below the safety floor and says so", () => {
    // female 45/150/20 sedentary: BMR 1126.5, TDEE 1351.8, −500 → 850 → floor 1200
    const t = calculateTargets(
      profile({ sex: "female", ageYears: 20, heightCm: 150, weightKg: 45, goalType: "lose_weight" }),
    );
    expect(t.calorieTarget).toBe(1200);
    expect(t.explanation).toContain("safe minimum of 1200 kcal");
  });

  it("keeps maintenance targets at TDEE", () => {
    // male 70/175/40 moderate: BMR 1598.75 → TDEE 2478.06 → nearest 25 = 2475
    const t = calculateTargets(
      profile({ ageYears: 40, heightCm: 175, weightKg: 70, activityLevel: "moderate" }),
    );
    expect(t.calorieTarget).toBe(2475);
    expect(t.proteinTargetG).toBe(84); // 1.2 g/kg
    expect(t.fatTargetG).toBe(69); // 2475×0.25/9 = 68.75 → 69
    expect(t.carbTargetG).toBe(380); // (2475 − 336 − 621)/4 = 379.5 → 380
  });

  it("uses the higher protein target for muscle building and a surplus", () => {
    const t = calculateTargets(profile({ goalType: "build_muscle" }));
    expect(t.calorieTarget).toBe(2425); // 2136 + 300 = 2436 → nearest 25 = 2425
    expect(t.proteinTargetG).toBe(160); // 2.0 g/kg × 80
  });

  it("always frames the explanation as an estimate, not a prescription", () => {
    const t = calculateTargets(profile());
    expect(t.explanation).toContain("not medical prescriptions");
  });
});
