import { serverEnv } from "@/lib/env";
import type { NormalizedExternalFood } from "@/types/food";
import {
  nutritionFromOff,
  parseServingGrams,
} from "@/lib/foods/nutrients";

const PRODUCT_URL = "https://world.openfoodfacts.org/api/v2/product";
// The legacy /cgi/search.pl endpoint is retired (returns 503). The official
// replacement is the "search-a-licious" service, which returns `{ hits: [] }`
// with the same product field names.
const SEARCH_URL = "https://search.openfoodfacts.org/search";
const TIMEOUT_MS = 8_000;

const FIELDS = [
  "code",
  "product_name",
  "product_name_en",
  "brands",
  "categories",
  "quantity",
  "serving_size",
  "serving_quantity",
  "nutriments",
  "image_front_url",
  "image_front_small_url",
].join(",");

function userAgent(): string {
  let email = "";
  try {
    email = serverEnv().offContactEmail ?? "";
  } catch {
    email = "";
  }
  return email
    ? `EatWise/1.0 (student project; contact ${email})`
    : "EatWise/1.0 (student project)";
}

/** OFF is keyless and always available. */
export function offConfigured(): boolean {
  return true;
}

interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  brands?: string | string[];
  categories?: string;
  quantity?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, unknown>;
  image_front_url?: string;
  image_front_small_url?: string;
}

/** Look up a product by barcode. Returns null when not found. */
export async function fetchOffByBarcode(
  barcode: string,
): Promise<NormalizedExternalFood | null> {
  if (!/^\d{6,14}$/.test(barcode)) return null;
  const url = `${PRODUCT_URL}/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`;
  const data = await fetchJson<{ status: number; product?: OffProduct }>(url);
  if (!data || data.status !== 1 || !data.product) return null;
  return mapOffProduct(data.product);
}

/** Name search on Open Food Facts (secondary source; USDA ranks first). */
export async function searchOff(
  query: string,
  limit = 4,
): Promise<NormalizedExternalFood[]> {
  const url = new URL(SEARCH_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("page_size", String(Math.min(limit * 3, 24)));
  url.searchParams.set("fields", FIELDS);

  const data = await fetchJson<{ hits?: OffProduct[] }>(url.toString());
  if (!data?.hits) return [];

  const out: NormalizedExternalFood[] = [];
  for (const p of data.hits) {
    const normalized = mapOffProduct(p);
    if (normalized) out.push(normalized);
    if (out.length >= limit) break;
  }
  return out;
}

/** search-a-licious returns brands as an array; the old API used a CSV string. */
function firstBrand(p: OffProduct): string | null {
  if (Array.isArray(p.brands)) {
    return p.brands.map((b) => b.trim()).filter(Boolean)[0] ?? null;
  }
  return p.brands?.split(",").map((b) => b.trim()).filter(Boolean)[0] ?? null;
}

function mapOffProduct(p: OffProduct): NormalizedExternalFood | null {
  const name = (p.product_name || p.product_name_en || "").trim();
  const code = (p.code || "").trim();
  if (!name || !code || !p.nutriments) return null;
  const nutrition = nutritionFromOff(p.nutriments);
  if (!nutrition) return null;

  const grams =
    parseServingGrams(p.serving_quantity ?? null) ?? parseServingGrams(p.serving_size ?? null);
  const firstCategory =
    p.categories?.split(",").map((c) => c.trim()).filter(Boolean)[0] ?? null;

  return {
    source: "openfoodfacts",
    source_id: code,
    name,
    brand: firstBrand(p),
    category: firstCategory,
    image_url: p.image_front_small_url || p.image_front_url || null,
    barcode: code,
    ...nutrition,
    serving_grams: grams,
    serving_label: grams != null ? `${grams} g` : (p.serving_size ?? null),
    source_url: `https://world.openfoodfacts.org/product/${code}`,
    source_metadata: { quantity: p.quantity ?? null, categories: p.categories ?? null },
  };
}

/**
 * Transport errors and non-OK statuses are THROWN so the caller's circuit
 * breaker can see them (404 is a legitimate "not found" and returns null).
 * Logging happens once at the breaker layer, never per keystroke here.
 */
async function fetchJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": userAgent() },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`off HTTP ${res.status}`);
  return (await res.json()) as T;
}
