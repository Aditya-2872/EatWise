/**
 * Estimated densities (g/ml) for volume → mass conversion, and average
 * weights (g) for count → mass conversion.
 *
 * These are engineering approximations for estimation flows only. When a
 * conversion is not confident the caller must ask the user instead of
 * guessing (spec §10.4: density is required for volume→mass).
 */

const DENSITY_KEYWORDS: Array<[RegExp, number]> = [
  [/\b(oil|ghee|butter|malai|cream)\b/i, 0.92],
  [/\b(honey|jaggery syrup|molasses|maple)\b/i, 1.42],
  [/\b(milk|doodh)\b/i, 1.03],
  [/\b(yogurt|curd|dahi)\b/i, 1.05],
  [/\b(rice|dal|lentil|beans|rajma|chana|chickpea)\b.*(raw|uncooked|dry)/i, 0.85],
  [/\b(rice|dal|lentil)\b/i, 0.85],
  [/\b(flour|atta|maida|besan|powder)\b/i, 0.55],
  [/\b(sugar|salt)\b/i, 0.85],
  [/\b(vegetable|veg|leafy|salad|spinach|palak)\b/i, 0.6],
  [/\b(oats|cereal|poha)\b/i, 0.45],
  [/\b(juice|water|tea|coffee|shake|lassi|soda|cola)\b/i, 1.0],
  [/\b(soup|sauce|gravy|curry|kadi)\b/i, 1.05],
];

/**
 * Estimate density for a food. Returns a value in [0.4, 1.5]; defaults to
 * 1.0 (water-like) for unknown foods, which is a reasonable assumption for
 * most cooked dishes and beverages.
 */
export function estimateDensity(foodName: string, category?: string | null): number {
  const haystack = `${foodName} ${category ?? ""}`;
  for (const [re, density] of DENSITY_KEYWORDS) {
    if (re.test(haystack)) return density;
  }
  return 1.0;
}

/**
 * True when a food's name/category matched the density table — i.e. a
 * volume→mass conversion for it is based on real data, not the water default.
 * Used by the UI to decide whether volume units (cup/tbsp/tsp) make sense.
 */
export function hasKnownDensity(foodName: string, category?: string | null): boolean {
  const haystack = `${foodName} ${category ?? ""}`;
  return DENSITY_KEYWORDS.some(([re]) => re.test(haystack));
}

const COUNT_WEIGHTS: Array<[RegExp, number, string]> = [
  [/\begg\b|\banda\b/i, 50, "1 medium egg (50 g)"],
  [/\bbanana\b|\bela\b/i, 118, "1 medium banana (118 g)"],
  [/\bapple\b|\bseb\b/i, 182, "1 medium apple (182 g)"],
  [/\borange\b|\bsantara\b/i, 131, "1 medium orange (131 g)"],
  [/\bmango\b|\baam\b/i, 200, "1 medium mango (200 g)"],
  [/\bguava\b|\bamrud\b/i, 55, "1 medium guava (55 g)"],
  [/\broti\b|\bchapati\b|\bphulka\b/i, 40, "1 medium roti (40 g)"],
  [/\bparatha\b/i, 80, "1 paratha (80 g)"],
  [/\bpuri\b|\bpapdi\b/i, 25, "1 puri (25 g)"],
  [/\bnaan\b/i, 90, "1 naan (90 g)"],
  [/\bbread slice\b|\bsliced bread\b|\bbread\b/i, 30, "1 slice bread (30 g)"],
  [/\bidli\b/i, 50, "1 idli (50 g)"],
  [/\bdosa\b/i, 90, "1 dosa (90 g)"],
  [/\bvada\b|\bvadai\b/i, 45, "1 vada (45 g)"],
  [/\bsamosa\b/i, 50, "1 samosa (50 g)"],
  [/\bkachori\b/i, 55, "1 kachori (55 g)"],
  [/\bmodak\b|\bladdoo\b|\bladdu\b|\bbarfi\b|\bburfi\b|\bgulab jamun\b|\bjalebi\b/i, 50, "1 piece (50 g)"],
  [/\bkaju\b|\bcashew\b|\bbadam\b|\balmond\b/i, 1.2, "1 nut (1.2 g)"],
  [/\bkela\b/i, 118, "1 medium banana (118 g)"],
  [/\btomato\b/i, 60, "1 medium tomato (60 g)"],
  [/\bpotato\b|\baloo\b/i, 170, "1 medium potato (170 g)"],
  [/\bonion\b|\bpyaz\b/i, 110, "1 medium onion (110 g)"],
  [/\bcarrot\b|\bgajar\b/i, 61, "1 medium carrot (61 g)"],
  [/\bcheese slice\b/i, 20, "1 cheese slice (20 g)"],
  [/\bpaneer\b/i, 30, "1 paneer cube (30 g)"],
  [/\bcookie\b|\bbiscuit\b/i, 10, "1 biscuit (10 g)"],
  [/\bhaldi\b|\btablet\b|\bpill\b|\bsupplement\b/i, 1, "1 tablet (1 g)"],
];

export interface CountConversion {
  gramsPerUnit: number;
  label: string;
}

/**
 * Average weight for "1 <food>" when logged by count. Returns null when
 * unknown — callers must then require grams (no silent guessing).
 */
export function estimateUnitWeight(foodName: string): CountConversion | null {
  for (const [re, grams, label] of COUNT_WEIGHTS) {
    if (re.test(foodName)) return { gramsPerUnit: grams, label };
  }
  return null;
}
