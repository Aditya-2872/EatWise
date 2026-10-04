import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  cacheExternalFood,
  getFoodByBarcode,
  searchInternalFoods,
} from "@/lib/foods/repository";
import { searchUsda, usdaConfigured } from "@/lib/foods/external/usda";
import { offConfigured, fetchOffByBarcode, searchOff } from "@/lib/foods/external/openfoodfacts";
import type { FoodItemRow, FoodSearchResult, NormalizedExternalFood } from "@/types/food";

const MAX_RESULTS = 12;
const EXTERNAL_CACHE_LIMIT = 6;

/** Small helper to project a cached row into the search-result shape. */
function toSearchResult(row: FoodItemRow, score: number): FoodSearchResult {
  return { ...row, score };
}

/**
 * Combined food search (spec §13.3):
 * - Postgres is searched first and ranked highest.
 * - USDA and Open Food Facts are searched together with it (when configured),
 *   normalized, and cached into `food_items` so logs reference internal rows.
 * - A failing external API degrades the result set, never the request.
 */
export async function searchFoodsCombined(
  query: string,
  opts: { userId?: string | null; limit?: number } = {},
): Promise<FoodSearchResult[]> {
  const limit = Math.min(opts.limit ?? MAX_RESULTS, MAX_RESULTS);
  const supabase = await createClient();

  const [internal, external] = await Promise.all([
    searchInternalFoods(supabase, query, opts.userId ?? null, limit),
    searchExternal(query).catch((err) => {
      console.warn("[foods] external search failed:", err);
      return [] as NormalizedExternalFood[];
    }),
  ]);

  const results: FoodSearchResult[] = [...internal];

  if (external.length > 0 && results.length < limit) {
    const cached = await cacheExternalBatch(external.slice(0, EXTERNAL_CACHE_LIMIT));
    // External rows rank below internal hits (scores start under ~120).
    let score = 5;
    for (const row of cached) {
      if (results.length >= limit) break;
      const dup = results.some(
        (r) =>
          r.normalized_name === row.normalized_name &&
          (r.brand ?? null) === (row.brand ?? null),
      );
      if (!dup) results.push(toSearchResult(row, score--));
    }
  }

  return results.slice(0, limit);
}

/**
 * Barcode lookup (spec §13.4): internal cache first, then Open Food Facts,
 * then USDA is not barcode-capable so it is skipped. A found external product
 * is cached into `food_items` before being returned.
 */
export async function lookupBarcode(barcode: string): Promise<FoodItemRow | null> {
  if (!/^\d{6,14}$/.test(barcode)) return null;
  const supabase = await createClient();

  const internal = await getFoodByBarcode(supabase, barcode);
  if (internal) return internal;

  if (!offConfigured()) return null;
  let external: NormalizedExternalFood | null = null;
  try {
    external = await fetchOffByBarcode(barcode);
  } catch (err) {
    console.warn(`[foods] off barcode lookup failed: ${errMsg(err)}`);
    return null;
  }
  if (!external) return null;

  const admin = createAdminClient();
  return cacheExternalFood(admin, external);
}

/* ------------------------------------------------------------------ */
/* External search: TTL cache + per-provider circuit breakers          */
/*                                                                     */
/* Every keystroke used to hit USDA + Open Food Facts directly; when    */
/* either was slow or down the whole search felt broken and the dev     */
/* console filled with errors. Now: results are cached in-process,      */
/* empty results are negatively cached, and a provider that fails       */
/* twice in a row is skipped for 5 minutes (one console.warn, not a     */
/* storm).                                                             */
/* ------------------------------------------------------------------ */

interface CacheEntry {
  at: number;
  items: NormalizedExternalFood[];
}
const externalCache = new Map<string, CacheEntry>();
const EXTERNAL_TTL_MS = 10 * 60_000;
const EMPTY_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 300;

interface BreakerState {
  failures: number;
  openUntil: number;
}
const breakers = new Map<string, BreakerState>();
const FAILURE_THRESHOLD = 2;
const COOLDOWN_MS = 5 * 60_000;

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function guardedSearch(
  provider: string,
  fn: () => Promise<NormalizedExternalFood[]>,
): Promise<NormalizedExternalFood[]> {
  const state = breakers.get(provider);
  if (state && state.openUntil > Date.now()) return [];
  try {
    const items = await fn();
    if (state) breakers.set(provider, { failures: 0, openUntil: 0 });
    return items;
  } catch (err) {
    const failures = (state?.failures ?? 0) + 1;
    const openUntil = failures >= FAILURE_THRESHOLD ? Date.now() + COOLDOWN_MS : 0;
    breakers.set(provider, { failures, openUntil });
    if (openUntil > 0) {
      console.warn(
        `[foods] ${provider} unreachable (${errMsg(err)}) — skipping it for 5 min`,
      );
    }
    return [];
  }
}

async function searchExternal(query: string): Promise<NormalizedExternalFood[]> {
  const key = query.toLowerCase().trim();
  const cached = externalCache.get(key);
  if (cached) {
    const ttl = cached.items.length > 0 ? EXTERNAL_TTL_MS : EMPTY_TTL_MS;
    if (Date.now() - cached.at < ttl) return cached.items;
  }

  const jobs: Promise<NormalizedExternalFood[]>[] = [];
  if (usdaConfigured()) jobs.push(guardedSearch("usda", () => searchUsda(query, 6)));
  if (offConfigured()) jobs.push(guardedSearch("off", () => searchOff(query, 4)));
  if (jobs.length === 0) return [];

  const settled = await Promise.allSettled(jobs);
  const out: NormalizedExternalFood[] = [];
  const seen = new Set<string>();
  for (const s of settled) {
    if (s.status !== "fulfilled") continue;
    for (const f of s.value) {
      const dedupeKey = `${f.source}:${f.source_id}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      out.push(f);
    }
  }
  // USDA first (priority), then OFF.
  out.sort((a, b) => (a.source === b.source ? 0 : a.source === "usda" ? -1 : 1));

  if (externalCache.size >= CACHE_MAX_ENTRIES) {
    let oldestKey: string | null = null;
    let oldestAt = Infinity;
    for (const [k, v] of externalCache) {
      if (v.at < oldestAt) {
        oldestAt = v.at;
        oldestKey = k;
      }
    }
    if (oldestKey) externalCache.delete(oldestKey);
  }
  externalCache.set(key, { at: Date.now(), items: out });
  return out;
}

async function cacheExternalBatch(foods: NormalizedExternalFood[]): Promise<FoodItemRow[]> {
  const admin = createAdminClient();
  const rows: FoodItemRow[] = [];
  for (const f of foods) {
    const row = await cacheExternalFood(admin, f);
    if (row) rows.push(row);
  }
  return rows;
}
