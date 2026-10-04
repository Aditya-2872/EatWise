"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  Apple,
  Moon,
  Plus,
  ScanBarcode,
  Search,
  Sun,
  Sunrise,
  UtensilsCrossed
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalorieRing } from "@/components/dashboard/calorie-ring";
import { NextMealCard } from "@/components/dashboard/next-meal-card";
import { TiltCard } from "@/components/motion/tilt-card";
import { cn } from "@/lib/utils";
import type { DaySummary, FoodLogRow } from "@/lib/logging/service";
import type { MealType, NutritionSnapshot } from "@/types/nutrition";

/* ------------------------------------------------------------------ */
/* Entrance motion — one shared, restrained rise (14px, smooth ease).  */
/* ------------------------------------------------------------------ */

const EASE_SMOOTH = [0.22, 1, 0.36, 1] as const;

function rise(delay: number) {
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.45, ease: EASE_SMOOTH, delay },
  };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function fmtQty(q: number): string {
  return Number.isInteger(q) ? String(q) : q.toFixed(1).replace(/\.0$/, "");
}

function pctOf(value: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((value / target) * 100));
}

const MEALS: { key: MealType; label: string; icon: typeof Sunrise }[] = [
  { key: "breakfast", label: "Breakfast", icon: Sunrise },
  { key: "lunch", label: "Lunch", icon: Sun },
  { key: "dinner", label: "Dinner", icon: Moon },
  { key: "snack", label: "Snacks", icon: Apple },
  { key: "custom", label: "Other", icon: UtensilsCrossed }
];

function MacroBar({
  label,
  value,
  target,
  unit,
  colorClass
}: {
  label: string;
  value: number;
  target: number | null;
  unit: string;
  colorClass: string;
}) {
  const pct = target != null ? pctOf(value, target) : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {Math.round(value)}
          {target != null ? ` / ${target} ${unit}` : ` ${unit}`}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${label}: ${Math.round(value)} of ${target ?? 0} ${unit}`}
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={target ?? Math.max(Math.round(value), 1)}
        className="bg-muted h-2 w-full overflow-hidden rounded-full">
        <motion.div
          className={cn("h-full rounded-full", colorClass)}
          initial={{ width: 0 }}
          animate={{ width: `${target != null ? pct : 0}%` }}
          transition={{ duration: 0.9, ease: EASE_SMOOTH, delay: 0.2 }}
        />
      </div>
    </div>
  );
}

function LogRow({ log }: { log: FoodLogRow }) {
  const snap: NutritionSnapshot = log.nutrition_snapshot;
  const name = log.food_name?.trim() || "Logged item";
  const showConfidence =
    log.confidence != null &&
    (log.source === "photo_ai" || log.source === "text" || log.source === "voice");

  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {name}
          {log.food_brand ? (
            <span className="text-muted-foreground font-normal"> · {log.food_brand}</span>
          ) : null}
        </p>
        <p className="text-muted-foreground text-xs tabular-nums">
          {fmtQty(log.quantity)} {log.unit}
          {showConfidence ? ` · ${Math.round((log.confidence as number) * 100)}% match` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {showConfidence && (
          <Badge variant="secondary" className="text-[10px]">
            AI
          </Badge>
        )}
        <span className="text-sm tabular-nums">{Math.round(snap.calories)} kcal</span>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export function DashboardView({
  summary,
  dateLabel,
  today
}: {
  summary: DaySummary;
  dateLabel: string;
  today: string;
}) {
  const { intake, targets, profile } = summary;
  const total = intake.total;
  const hasLogs = intake.logs.length > 0;
  const greeting = profile?.displayName ? `Hi ${profile.displayName},` : "Today";

  const mealsWithLogs = MEALS.filter(
    (m) => (intake.byMeal[m.key]?.calories ?? 0) > 0 || intake.logs.some((l) => l.meal_type === m.key)
  );
  const visibleMeals = mealsWithLogs.length > 0 ? mealsWithLogs : MEALS.slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div className="flex flex-wrap items-end justify-between gap-2" {...rise(0)}>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{greeting}</h1>
          <p className="text-muted-foreground text-sm">{dateLabel}</p>
        </div>
        <Button size="sm" render={<Link href={`/app/log?date=${today}`} />}>
          <Plus aria-hidden />
          Log food
        </Button>
      </motion.div>

      {/* Calorie + macro cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <TiltCard className="md:col-span-2">
          <motion.div {...rise(0.06)} className="h-full">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-base">Calories</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-3">
                <CalorieRing consumed={total.calories} target={targets?.calorieTarget ?? null} />
                {targets ? (
                  <p className="text-muted-foreground text-center text-xs">
                    Goal: {targets.goalType.replaceAll("_", " ")} · target set from your profile
                  </p>
                ) : (
                  <p className="text-muted-foreground text-center text-xs">
                    No active goal —{" "}
                    <Link href="/app/goals" className="text-primary underline-offset-4 hover:underline">
                      set one
                    </Link>
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TiltCard>

        <motion.div className="md:col-span-3" {...rise(0.12)}>
          <Card className="h-full">
          <CardHeader>
            <CardTitle className="text-base">Macronutrients</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <MacroBar
              label="Protein"
              value={total.proteinG}
              target={targets?.proteinTargetG ?? null}
              unit="g"
              colorClass="bg-violet-500"
            />
            <MacroBar
              label="Carbs"
              value={total.carbsG}
              target={targets?.carbTargetG ?? null}
              unit="g"
              colorClass="bg-amber-500"
            />
            <MacroBar
              label="Fat"
              value={total.fatG}
              target={targets?.fatTargetG ?? null}
              unit="g"
              colorClass="bg-rose-500"
            />
            <div className="text-muted-foreground grid grid-cols-3 gap-2 border-t pt-3 text-center text-xs">
              <div>
                <p className="text-foreground text-sm font-medium tabular-nums">
                  {Math.round(total.fiberG)} g
                </p>
                Fiber
              </div>
              <div>
                <p className="text-foreground text-sm font-medium tabular-nums">
                  {Math.round(total.sugarG)} g
                </p>
                Sugar
              </div>
              <div>
                <p className="text-foreground text-sm font-medium tabular-nums">
                  {Math.round(total.sodiumMg)} mg
                </p>
                Sodium
              </div>
            </div>
          </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Meals */}
      <div className="grid gap-4 md:grid-cols-2">
        {visibleMeals.map((meal, idx) => {
          const logs = intake.logs.filter((l) => l.meal_type === meal.key);
          const mealTotal = intake.byMeal[meal.key];
          const Icon = meal.icon;
          return (
            <motion.div key={meal.key} {...rise(0.16 + idx * 0.05)}>
              <Card className="h-full">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="text-muted-foreground size-4" aria-hidden />
                  {meal.label}
                  <span className="text-muted-foreground text-sm font-normal tabular-nums">
                    {Math.round(mealTotal?.calories ?? 0)} kcal
                  </span>
                </CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  render={<Link href={`/app/log?meal=${meal.key}&date=${today}`} />}
                  aria-label={`Add to ${meal.label}`}>
                  <Plus aria-hidden />
                </Button>
              </CardHeader>
              <CardContent>
                {logs.length === 0 ? (
                  <p className="text-muted-foreground py-2 text-sm">Nothing logged yet.</p>
                ) : (
                  <ul className="divide-y">
                    {logs.map((log) => (
                      <LogRow key={log.id} log={log} />
                    ))}
                  </ul>
                )}
              </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Next-Meal Intelligence (spec §5) */}
      <motion.div {...rise(0.3)}>
        <NextMealCard today={today} />
      </motion.div>

      {/* Empty-day CTA */}
      {!hasLogs && (
        <motion.div {...rise(0.36)}>
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
              <div>
                <p className="font-medium">Start tracking today</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Snap a photo, scan a barcode, or search for what you ate.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Button render={<Link href="/app/log?mode=photo" />}>
                  <Apple aria-hidden />
                  Photo (AI)
                </Button>
                <Button variant="outline" render={<Link href="/app/log?mode=barcode" />}>
                  <ScanBarcode aria-hidden />
                  Barcode
                </Button>
                <Button variant="outline" render={<Link href="/app/log?mode=search" />}>
                  <Search aria-hidden />
                  Search food
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
