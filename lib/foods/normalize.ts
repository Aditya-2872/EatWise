/**
 * Canonical name normalization for `food_items.normalized_name`
 * (must match the seed convention: lowercase, trimmed).
 */
export function normalizeFoodName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
