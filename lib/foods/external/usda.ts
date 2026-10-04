import { serverEnv } from "@/lib/env";
import type { NormalizedExternalFood } from "@/types/food";
import {
  nutritionFromUsda,
  parseServingGrams,
} from "@/lib/foods/nutrients";

const BASE_URL = "https://api.fdc.nal.usda.gov/fdc/v1";
const TIMEOUT_MS = 8_000;
const DATA_TYPES = "Foundation,SR Legacy,Branded,Survey (FNDDS)";

export function usdaConfigured(): boolean {
  try {
    return Boolean(serverEnv().usdaApiKey);
  } catch {
    return false;
  }
}

function apiKey(): string {
  return serverEnv().usdaApiKey ?? "";
}

interface UsdaFood {
  fdcId: number;
  description: string;
  brandOwner?: string;
  brandName?: string;
  dataType?: string;
  foodClass?: string;
  servingSize?: number | null;
  servingSizeUnit?: string | null;
  imageURL?: string | null;
  foodNutrients?: Array<{
    nutrientNumber?: string;
    nutrientId?: number;
    amount?: number | null;
  }>;
}

/**
 * Search USDA FoodData Central by name. Entries missing core macros are
 * dropped — a food that cannot produce a snapshot must never be offered.
 */
export async function searchUsda(
  query: string,
  limit = 6,
): Promise<NormalizedExternalFood[]> {
  if (!usdaConfigured()) return [];
  const url = new URL(`${BASE_URL}/foods/search`);
  url.searchParams.set("api_key", apiKey());
  url.searchParams.set("query", query);
  url.searchParams.set("pageSize", String(Math.min(limit * 2, 20)));
  url.searchParams.set("pageNumber", "1");
  url.searchParams.set("dataType", DATA_TYPES);

  const data = await fetchJson<{ foods?: UsdaFood[] }>(url.toString());
  if (!data) return [];

  const out: NormalizedExternalFood[] = [];
  for (const f of data.foods ?? []) {
    const normalized = mapUsdaFood(f);
    if (normalized) out.push(normalized);
    if (out.length >= limit) break;
  }
  return out;
}

/** Fetch a single USDA food by fdcId. */
export async function fetchUsdaFood(
  fdcId: string,
): Promise<NormalizedExternalFood | null> {
  if (!usdaConfigured()) return null;
  const url = new URL(`${BASE_URL}/food/${encodeURIComponent(fdcId)}`);
  url.searchParams.set("api_key", apiKey());
  const data = await fetchJson<UsdaFood>(url.toString());
  if (!data) return null;
  return mapUsdaFood(data);
}

function mapUsdaFood(f: UsdaFood): NormalizedExternalFood | null {
  if (!f?.description || !f.fdcId) return null;
  const nutrition = nutritionFromUsda(f.foodNutrients ?? []);
  if (!nutrition) return null;
  const grams = parseServingGrams(f.servingSize ?? null, f.servingSizeUnit ?? null);
  return {
    source: "usda",
    source_id: String(f.fdcId),
    name: cleanName(f.description),
    brand: f.brandOwner || f.brandName || null,
    category: f.dataType || f.foodClass || null,
    image_url: f.imageURL || null,
    ...nutrition,
    serving_grams: grams,
    serving_label: grams != null ? `${grams} g` : null,
    source_url: `https://fdc.nal.usda.gov/fdc-app.html#/food-details/${f.fdcId}/nutrients`,
    source_metadata: {
      dataType: f.dataType ?? null,
      servingSize: f.servingSize ?? null,
      servingSizeUnit: f.servingSizeUnit ?? null,
    },
  };
}

function cleanName(description: string): string {
  // USDA names are often ALL CAPS; title-case them for readability.
  const name = description.trim();
  if (name === name.toUpperCase() && name.length > 3) {
    return name.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
  }
  return name;
}

/**
 * Transport errors and non-OK statuses are THROWN so the caller's circuit
 * breaker can see them (404 is a legitimate "not found" and returns null).
 * Logging happens once at the breaker layer, never per keystroke here.
 */
async function fetchJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`usda HTTP ${res.status}`);
  return (await res.json()) as T;
}
