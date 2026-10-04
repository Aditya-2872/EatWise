/**
 * Barcode normalization (spec §15 — "Normalize the scanned code before lookup").
 * Pure and isomorphic: used by the camera scanner UI and the API boundary.
 */

/**
 * Clean a raw detector/keyboard payload into a retail GTIN.
 * Tolerates spaces and hyphens (common human formatting), but any other
 * non-digit means this isn't a product barcode (e.g. a Code-128 shipping
 * label) and is rejected — valid retail codes are 6-14 digits.
 * Returns null when the payload can't be a barcode.
 */
export function normalizeBarcode(raw: string): string | null {
  const cleaned = raw.replace(/[\s-]/g, "");
  if (!/^\d{6,14}$/.test(cleaned)) return null;
  return cleaned;
}
