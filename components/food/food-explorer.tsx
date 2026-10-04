"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, PackagePlus, X } from "lucide-react";

import { CustomFoodForm } from "@/components/logging/custom-food-form";
import { FoodSearch } from "@/components/logging/food-search";
import { LogFoodDialog } from "@/components/logging/log-food-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { FoodItemRow } from "@/types/food";
import type { LogSource, MealType } from "@/types/nutrition";

function perServingLabel(f: FoodItemRow): string {
  return `${f.serving_size} ${f.serving_unit} · ${Math.round(f.calories)} kcal · P ${Math.round(
    f.protein_g,
  )}g · C ${Math.round(f.carbs_g)}g · F ${Math.round(f.fat_g)}g`;
}

export interface FoodExplorerProps {
  today: string;
  defaultMeal: MealType;
  initialCustomFoods: FoodItemRow[];
}

export function FoodExplorer({ today, defaultMeal, initialCustomFoods }: FoodExplorerProps) {
  const queryClient = useQueryClient();
  const [dialogFood, setDialogFood] = useState<{ food: FoodItemRow; source: LogSource } | null>(
    null,
  );
  const [showCreateForm, setShowCreateForm] = useState(false);

  const customQuery = useQuery({
    queryKey: ["custom-foods"],
    queryFn: async () => {
      const res = await fetch("/api/foods/custom");
      if (!res.ok) throw new Error("Could not load your foods");
      return (await res.json()) as { foods: FoodItemRow[] };
    },
    initialData: { foods: initialCustomFoods },
    staleTime: 30_000,
  });

  function invalidateRelated() {
    void queryClient.invalidateQueries({ queryKey: ["recent-foods"] });
    void queryClient.invalidateQueries({ queryKey: ["custom-foods"] });
  }

  const customFoods = customQuery.data?.foods ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Foods</h1>
          <p className="text-muted-foreground text-sm">
            Search the catalog and your own foods, then log them for today.
          </p>
        </div>
        {!showCreateForm && (
          <Button size="sm" variant="outline" onClick={() => setShowCreateForm(true)}>
            <PackagePlus aria-hidden />
            New custom food
          </Button>
        )}
      </div>

      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add your own food</CardTitle>
            <CardDescription>
              Homemade dishes and local foods — private to you, reusable every day.
            </CardDescription>
            <CardAction>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowCreateForm(false)}
                aria-label="Close custom food form">
                <X aria-hidden />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <CustomFoodForm
              onCreated={(food) => {
                invalidateRelated();
                setShowCreateForm(false);
                setDialogFood({ food, source: "manual" });
              }}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Search</CardTitle>
          <CardDescription>Internal catalog, USDA and Open Food Facts.</CardDescription>
        </CardHeader>
        <CardContent>
          <FoodSearch onSelect={(food, source) => setDialogFood({ food, source })} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My foods</CardTitle>
          <CardDescription>Custom foods you created — tap to log.</CardDescription>
        </CardHeader>
        <CardContent>
          {customQuery.isFetching && !customQuery.isPending ? (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Refreshing…
            </p>
          ) : customFoods.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
              No custom foods yet. Add one above for things like “home-style dal” or “amma’s
              idli” so you can log them in a tap.
            </p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {customFoods.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => setDialogFood({ food: f, source: "manual" })}
                    className="hover:bg-accent/50 flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{f.name}</span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {f.brand ? `${f.brand} · ` : ""}
                        {perServingLabel(f)}
                      </span>
                    </span>
                    {f.source === "ai" ? (
                      <Badge variant="outline" className="shrink-0 text-[10px] uppercase">
                        AI
                      </Badge>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <LogFoodDialog
        food={dialogFood?.food ?? null}
        open={dialogFood != null}
        onOpenChange={(o) => {
          if (!o) setDialogFood(null);
        }}
        date={today}
        dateIsToday
        defaultMeal={defaultMeal}
        source={dialogFood?.source ?? "search"}
        onLogged={invalidateRelated}
      />
    </div>
  );
}
