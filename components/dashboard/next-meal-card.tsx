"use client";

/**
 * Next-Meal Intelligence (spec §5/§25): on-demand plan for the remaining
 * meal slots of today, built from the user's real budget + frequent foods.
 * Requested only on click and cached in sessionStorage — the AI free tier
 * is small, so we never spend calls the user didn't ask for. Estimates are
 * illustrative; logging anything recomputes exact values server-side.
 */
import Link from "next/link";
import { useState } from "react";
import { Loader2, Sparkles, UtensilsCrossed } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { MealPlanResponse } from "@/types/ai";

function cacheKey(today: string) {
  return `eatwise:meal-plan:${today}`;
}

function loadCached(today: string): MealPlanResponse | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(today));
    return raw ? (JSON.parse(raw) as MealPlanResponse) : null;
  } catch {
    return null;
  }
}

const MEAL_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack"
};

export function NextMealCard({ today }: { today: string }) {
  const [plan, setPlan] = useState<MealPlanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function suggest() {
    const cached = loadCached(today);
    if (cached) {
      setPlan(cached);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/meal-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      if (!res.ok) {
        let msg = "Could not generate a meal suggestion.";
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error) msg = body.error;
        } catch {
          /* keep fallback */
        }
        setError(msg);
        return;
      }
      const data = (await res.json()) as MealPlanResponse;
      setPlan(data);
      try {
        sessionStorage.setItem(cacheKey(today), JSON.stringify(data));
      } catch {
        /* storage full/unavailable — non-fatal */
      }
    } catch {
      setError("Network error while planning your next meal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <UtensilsCrossed className="text-primary size-4" aria-hidden /> What should you eat next?
        </CardTitle>
        <CardDescription>
          An AI suggestion fitted to your remaining calorie and macro budget today, using foods you
          already eat.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!plan && (
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" onClick={() => void suggest()} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden /> Planning…
                </>
              ) : (
                <>
                  <Sparkles aria-hidden /> Suggest my next meal
                </>
              )}
            </Button>
            <span className="text-muted-foreground text-xs">
              Generated on request — limited per day on the AI free tier.
            </span>
          </div>
        )}

        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}

        {plan && (
          <div className="space-y-4" aria-live="polite">
            {plan.plan.meals.map((meal, i) => {
              const kcal = meal.items.reduce((s, it) => s + it.estimated_calories, 0);
              const protein = meal.items.reduce((s, it) => s + it.estimated_protein_g, 0);
              return (
                <div key={i} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold">
                      {MEAL_LABELS[meal.meal_type] ?? meal.meal_type} · {meal.name}
                    </p>
                    <p className="text-muted-foreground text-xs tabular-nums">
                      ≈ {Math.round(kcal)} kcal · {Math.round(protein)} g protein (illustrative)
                    </p>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {meal.items.map((it, j) => (
                      <li key={j} className="text-muted-foreground text-sm tabular-nums">
                        {it.food_name} — {it.quantity} {it.unit} ·{" "}
                        {Math.round(it.estimated_calories)} kcal
                      </li>
                    ))}
                  </ul>
                  {meal.note && <p className="text-muted-foreground mt-2 text-xs italic">{meal.note}</p>}
                </div>
              );
            })}

            <p className="text-muted-foreground text-sm leading-relaxed">{plan.plan.rationale}</p>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" render={<Link href={`/app/log?date=${today}`} />}>
                Log it
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPlan(null)}>
                Hide
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              Numbers shown are estimates for planning — when you log a food, exact nutrition is
              computed from the verified database.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
