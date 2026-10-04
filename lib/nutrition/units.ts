/**
 * Deterministic unit conversions (spec §18).
 * Mass and volume are separate dimensions; converting between them requires
 * a density (g/ml) which callers must supply explicitly — no silent guesses.
 */

/** Grams per unit, for mass units. */
export const MASS_TO_GRAMS: Record<string, number> = {
  mg: 0.001,
  g: 1,
  kg: 1000,
  oz: 28.349523125,
  lb: 453.59237,
};

/** Milliliters per unit, for volume units. */
export const VOLUME_TO_ML: Record<string, number> = {
  ml: 1,
  l: 1000,
  tsp: 5,
  tbsp: 15,
  cup: 240, // US customary cup, used consistently across the app
  floz: 29.5735,
};

/** Common alias → canonical unit. */
const UNIT_ALIASES: Record<string, string> = {
  gram: "g",
  grams: "g",
  gm: "g",
  milligram: "mg",
  milligrams: "mg",
  kilogram: "kg",
  kilograms: "kg",
  kilo: "kg",
  ounce: "oz",
  ounces: "oz",
  pound: "lb",
  pounds: "lb",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  liter: "l",
  liters: "l",
  litre: "l",
  litres: "l",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  cups: "cup",
  serving: "unit",
  servings: "unit",
  piece: "unit",
  pieces: "unit",
  count: "unit", // UI/quick-add speak "count"; canonical form is "unit"
  unit: "unit",
  units: "unit",
};

export type UnitKind = "mass" | "volume" | "count";

export function normalizeUnit(unit: string): string {
  const u = unit.trim().toLowerCase();
  return UNIT_ALIASES[u] ?? u;
}

export function unitKind(unit: string): UnitKind | null {
  const u = normalizeUnit(unit);
  if (u in MASS_TO_GRAMS) return "mass";
  if (u in VOLUME_TO_ML) return "volume";
  if (u === "unit") return "count";
  return null;
}

/**
 * Convert a quantity between two units.
 * Returns null when the units are incompatible (e.g. g → cup without density,
 * or unknown units). Count units ("unit") only convert to themselves.
 *
 * @param densityGPerMl density used when bridging mass ↔ volume (1.0 if omitted
 *   only when both units are the same kind — never for cross-kind conversion).
 */
export function convertQuantity(
  quantity: number,
  fromUnitRaw: string,
  toUnitRaw: string,
  densityGPerMl?: number,
): number | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  const from = normalizeUnit(fromUnitRaw);
  const to = normalizeUnit(toUnitRaw);
  if (from === to) return quantity;

  const fromKind = unitKind(from);
  const toKind = unitKind(to);
  if (!fromKind || !toKind) return null;

  if (fromKind === "count" || toKind === "count") return null;

  // Same-kind conversion
  if (fromKind === "mass" && toKind === "mass") {
    return (quantity * MASS_TO_GRAMS[from]) / MASS_TO_GRAMS[to];
  }
  if (fromKind === "volume" && toKind === "volume") {
    return (quantity * VOLUME_TO_ML[from]) / VOLUME_TO_ML[to];
  }

  // Cross-kind requires an explicit density.
  if (!densityGPerMl || densityGPerMl <= 0) return null;

  if (fromKind === "volume" && toKind === "mass") {
    const grams = quantity * VOLUME_TO_ML[from] * densityGPerMl;
    return grams / MASS_TO_GRAMS[to];
  }
  if (fromKind === "mass" && toKind === "volume") {
    const grams = quantity * MASS_TO_GRAMS[from];
    const ml = grams / densityGPerMl;
    return ml / VOLUME_TO_ML[to];
  }
  return null;
}

/**
 * Convert any supported unit to grams, using density for volume units.
 * Returns null when not possible.
 */
export function toGrams(
  quantity: number,
  unit: string,
  densityGPerMl = 1,
): number | null {
  const u = normalizeUnit(unit);
  const kind = unitKind(u);
  if (kind === "mass") return quantity * MASS_TO_GRAMS[u];
  if (kind === "volume") return quantity * VOLUME_TO_ML[u] * densityGPerMl;
  return null;
}

/** kg ↔ lb display helpers (user_settings.units). */
export function kgToLb(kg: number): number {
  return kg * 2.2046226218;
}

export function lbToKg(lb: number): number {
  return lb / 2.2046226218;
}
