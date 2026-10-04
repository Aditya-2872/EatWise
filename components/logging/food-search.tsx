"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { FoodItemRow, FoodSearchResult, UserFoodRow } from "@/types/food";

interface FoodSearchProps {
  onSelect: (food: FoodItemRow, source: "search") => void;
}

function perServingLabel(f: FoodItemRow): string {
  return `${f.serving_size} ${f.serving_unit} · ${Math.round(f.calories)} kcal · P ${Math.round(
    f.protein_g
  )}g · C ${Math.round(f.carbs_g)}g · F ${Math.round(f.fat_g)}g`;
}

/** Wait until the user pauses typing before firing a search request. */
function useDebounced(value: string, delayMs = 400): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function SearchSkeleton() {
  return (
    <ul className="divide-y rounded-xl border" aria-hidden>
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex items-center gap-3 px-3 py-2.5">
          <div className="min-w-0 flex-1 space-y-2">
            <div
              className="bg-muted h-3.5 rounded-full animate-pulse"
              style={{ width: `${60 - i * 12}%`, animationDelay: `${i * 90}ms` }}
            />
            <div
              className="bg-muted/70 h-2.5 rounded-full animate-pulse"
              style={{ width: `${85 - i * 10}%`, animationDelay: `${i * 90 + 45}ms` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function FoodSearch({ onSelect }: FoodSearchProps) {
  const [q, setQ] = useState("");
  const debounced = useDebounced(q, 400);
  const query = debounced.trim();
  const typing = q.trim().length >= 2 && q.trim() !== query;

  const search = useQuery<{ results: FoodSearchResult[] }>({
    queryKey: ["food-search", query],
    queryFn: async () => {
      const res = await fetch(`/api/foods/search?q=${encodeURIComponent(query)}&limit=12`);
      const body = (await res.json()) as { results?: FoodSearchResult[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Search failed");
      return { results: body.results ?? [] };
    },
    enabled: query.length >= 2,
    staleTime: 60_000
  });

  const recent = useQuery<{ foods: UserFoodRow[] }>({
    queryKey: ["recent-foods"],
    queryFn: async () => {
      const res = await fetch("/api/foods/recent");
      if (!res.ok) throw new Error("Could not load recent foods");
      return (await res.json()) as { foods: UserFoodRow[] };
    },
    staleTime: 30_000
  });

  const showRecent = query.length < 2;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search foods — roti, paneer, dal, corn flakes…"
          aria-label="Search foods"
          className="pl-9"
          autoComplete="off"
        />
      </div>

      {showRecent && (
        <div>
          <p className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-medium">
            <Clock className="size-3.5" aria-hidden />
            Recent & frequent
          </p>
          {recent.isLoading ? (
            <ul className="divide-y rounded-xl border" aria-hidden>
              {[0, 1].map((i) => (
                <li key={i} className="space-y-2 px-3 py-3">
                  <div className="bg-muted h-3.5 w-1/3 rounded-full animate-pulse" />
                  <div
                    className="bg-muted/70 h-2.5 w-2/3 rounded-full animate-pulse"
                    style={{ animationDelay: "90ms" }}
                  />
                </li>
              ))}
            </ul>
          ) : (recent.data?.foods.length ?? 0) === 0 ? (
            <p className="text-muted-foreground text-sm">
              Foods you log will appear here for one-tap re-logging.
            </p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {recent.data!.foods.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(f, "search")}
                    className="hover:bg-accent/50 flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {f.custom_name ?? f.name}
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {perServingLabel(f)}
                      </span>
                    </span>
                    {f.usual_quantity != null && f.usual_unit ? (
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        usual: {f.usual_quantity} {f.usual_unit}
                      </Badge>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!showRecent && (
        <div aria-busy={search.isFetching || typing} aria-live="polite">
          {search.isPending || typing ? (
            <SearchSkeleton />
          ) : search.isError ? (
            <p className="text-destructive text-sm">
              {search.error instanceof Error ? search.error.message : "Search failed."}
            </p>
          ) : search.data!.results.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nothing found for “{query}”. Try a simpler name, or add it manually below.
            </p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {search.data!.results.map((f) => (
                <li key={`${f.source}:${f.id}`}>
                  <button
                    type="button"
                    onClick={() => onSelect(f, "search")}
                    className="hover:bg-accent/50 flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left">
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{f.name}</span>
                        {f.source !== "seed" && f.source !== "user" ? (
                          <Badge variant="outline" className="shrink-0 text-[10px] uppercase">
                            {f.source === "usda" ? "USDA" : f.source === "openfoodfacts" ? "OFF" : f.source}
                          </Badge>
                        ) : null}
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {f.brand ? `${f.brand} · ` : ""}
                        {perServingLabel(f)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
