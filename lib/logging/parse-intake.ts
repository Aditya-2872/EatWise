/**
 * Deterministic natural-language intake parser (no AI, no network).
 *
 * Turns text like "2 eggs and 1 tbsp oil, 1 katori dal" into structured
 * items the UI can resolve against the food catalog. Deliberately simple
 * and predictable: quantities, units and a food name per fragment.
 */

import { normalizeUnit, unitKind } from "@/lib/nutrition/units";

export interface ParsedIntakeItem {
  /** Parsed quantity (always > 0). */
  qty: number;
  /** Normalized unit, or null when the user didn't specify one. */
  unit: string | null;
  /** True when the unit came from the text (vs. inferred later). */
  unitExplicit: boolean;
  /** Food name to search for. */
  name: string;
  /** Original fragment (for display/debugging). */
  raw: string;
}

const UNICODE_FRACTIONS: Record<string, number> = {
  "½": 0.5,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 0.25,
  "¾": 0.75,
  "⅛": 0.125,
};

const WORD_NUMBERS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  half: 0.5,
  quarter: 0.25,
};

/** Units people type in free text → canonical unit ("count" for pieces). */
const UNIT_WORDS: Record<string, string> = {
  g: "g",
  gram: "g",
  grams: "g",
  gm: "g",
  kg: "kg",
  kilo: "kg",
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  l: "l",
  litre: "l",
  liter: "l",
  cup: "cup",
  cups: "cup",
  katori: "count",
  bowl: "count",
  bowls: "count",
  plate: "count",
  plates: "count",
  glass: "count",
  glasses: "count",
  tbsp: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  tsp: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  piece: "count",
  pieces: "count",
  pcs: "count",
  pc: "count",
  slice: "count",
  slices: "count",
  count: "count",
  serving: "count",
  servings: "count",
  medium: "", // "2 medium eggs" — adjective, not a unit
  small: "",
  large: "",
};

// Fraction FIRST so "1/2 tsp" doesn't lose the "/2" to the integer group.
// Groups: 1=frac, 2=int, 3=word (ES2017 target — no named groups).
const QTY_RE =
  /^(\d+\s*\/\s*\d+|[½⅓⅔¼¾⅛])?\s*(\d+)?\s*(half|quarter|a|an|one|two|three|four|five|six)?\b\s*/i;

function parseQtyToken(text: string): { qty: number | null; rest: string } {
  const m = QTY_RE.exec(text);
  if (!m) return { qty: null, rest: text };
  const frac = m[1];
  const int = m[2];
  const word = m[3];
  if (!int && !frac && !word) return { qty: null, rest: text };

  let qty = 0;
  if (int) qty += Number(int);
  if (frac) {
    if (frac in UNICODE_FRACTIONS) {
      qty += UNICODE_FRACTIONS[frac];
    } else {
      const [n, d] = frac.split("/").map((s) => Number(s.trim()));
      if (d > 0) qty += n / d;
    }
  }
  if (word && !int && !frac) {
    const w = WORD_NUMBERS[word.toLowerCase()];
    if (w != null) qty += w;
  }
  if (qty <= 0) return { qty: null, rest: text };
  return { qty, rest: text.slice(m[0].length) };
}

function parseUnitToken(text: string): { unit: string | null; matched: boolean; rest: string } {
  const m = /^([a-z½⅓⅔¼¾⅛]+)\b\.?\s*(?:of\b\s*)?/i.exec(text);
  if (!m) return { unit: null, matched: false, rest: text };
  const token = m[1].toLowerCase();
  if (!(token in UNIT_WORDS)) return { unit: null, matched: false, rest: text };
  const unit = UNIT_WORDS[token];
  // matched=true even for size adjectives ("2 medium eggs") so they are
  // consumed from the fragment and don't pollute the food name.
  return { unit: unit === "" ? null : unit, matched: true, rest: text.slice(m[0].length) };
}

/** Fragments that carry no food meaning — dropped instead of searched. */
const STOPWORD_NAMES = new Set([
  "of", "the", "and", "or", "some", "item", "items", "something", "nothing", "etc",
]);

function cleanName(name: string): string {
  return name
    .replace(/\s+/g, " ")
    .replace(/^[,-\s]+|[,-\s]+$/g, "")
    .trim();
}

/**
 * Parse free-text intake into items. Splitting on commas/semicolons/newlines
 * and the word "and" keeps the grammar trivial and predictable.
 */
export function parseIntake(text: string): ParsedIntakeItem[] {
  const fragments = text
    .split(/[,;\n]|\s\+\s|\band\b/i)
    .map((f) => f.trim())
    .filter(Boolean);

  const items: ParsedIntakeItem[] = [];
  for (const raw of fragments) {
    let rest = raw;

    // Leading quantity ("2 eggs", "1/2 cup milk", "half apple")
    const q = parseQtyToken(rest);
    let qty = q.qty;
    if (qty != null) rest = q.rest;

    // Optional explicit unit ("1 tbsp oil", "250 g rice")
    const u = parseUnitToken(rest);
    let unit = u.unit;
    if (u.matched) rest = u.rest;

    // Trailing quantity+unit ("rice 250 g", "milk 200ml") — only when no
    // leading quantity was given, so "2 eggs 50 g" keeps its count of 2.
    const trailing =
      /\b(\d+(?:\.\d+)?)\s*(g|kg|ml|l|cup|cups|tbsp|tsp|grams?)\.?$/i.exec(rest);
    if (trailing && qty == null) {
      qty = Number(trailing[1]);
      unit = normalizeUnit(trailing[2]);
      rest = rest.slice(0, trailing.index);
    }

    // Unit glued to a leading number ("250g rice", "200ml milk")
    if (qty == null) {
      const glued = /^(\d+(?:\.\d+)?)\s*(g|kg|ml|l|cup|cups|tbsp|tsp|grams?)\b\.?\s*/i.exec(rest);
      if (glued) {
        qty = Number(glued[1]);
        unit = normalizeUnit(glued[2]);
        rest = rest.slice(glued[0].length);
      }
    }

    const name = cleanName(rest);
    if (!name || STOPWORD_NAMES.has(name.toLowerCase())) continue;

    if (unit != null && unitKind(unit) == null && unit !== "count") unit = null;

    items.push({
      qty: qty ?? 1,
      unit,
      unitExplicit: unit != null,
      name,
      raw,
    });
  }
  return items;
}
