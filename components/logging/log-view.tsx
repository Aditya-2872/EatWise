"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import { BarcodePanel } from "@/components/logging/barcode-panel";
import { CustomFoodForm } from "@/components/logging/custom-food-form";
import { DayLogs } from "@/components/logging/day-logs";
import { FoodSearch } from "@/components/logging/food-search";
import { LogFoodDialog } from "@/components/logging/log-food-dialog";
import { PhotoPanel } from "@/components/logging/photo-panel";
import { QuickAdd } from "@/components/logging/quick-add";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DaySummary } from "@/lib/logging/service";
import type { FoodItemRow } from "@/types/food";
import type { LogSource, MealType } from "@/types/nutrition";

function shiftDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

export interface LogViewProps {
  initialSummary: DaySummary;
  initialDate: string;
  today: string;
  defaultMeal: MealType;
  defaultMode: string;
}

export function LogView({ initialSummary, initialDate, today, defaultMeal, defaultMode }: LogViewProps) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(initialDate);
  const [dialogFood, setDialogFood] = useState<{ food: FoodItemRow; source: LogSource } | null>(null);

  const dateIsToday = date === today;

  const dayQuery = useQuery({
    queryKey: ["day", date],
    queryFn: async () => {
      const res = await fetch(`/api/day?date=${encodeURIComponent(date)}`);
      if (!res.ok) throw new Error("Could not load this day");
      return (await res.json()) as DaySummary;
    },
    ...(date === initialDate ? { initialData: initialSummary } : {}),
    staleTime: 15_000
  });

  const summary = dayQuery.data;

  const mode = useMemo(() => {
    return ["quick", "search", "barcode", "photo", "manual"].includes(defaultMode)
      ? defaultMode
      : "quick";
  }, [defaultMode]);

  const total = summary?.intake.total;
  const targets = summary?.targets;

  function invalidateDay() {
    void queryClient.invalidateQueries({ queryKey: ["day", date] });
    void queryClient.invalidateQueries({ queryKey: ["recent-foods"] });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Log food</h1>
        <p className="text-muted-foreground text-sm">
          Type what you ate, scan a barcode, or snap a photo — grams optional.
        </p>
      </div>

      {/* Date navigation */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDate((d) => shiftDate(d, -1))}
          aria-label="Previous day">
          <ChevronLeft aria-hidden />
        </Button>
        <Input
          type="date"
          value={date}
          max={today}
          onChange={(e) => {
            if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) setDate(e.target.value);
          }}
          aria-label="Logged day"
          className="w-40"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDate((d) => shiftDate(d, 1))}
          disabled={date >= today}
          aria-label="Next day">
          <ChevronRight aria-hidden />
        </Button>
        {total && (
          <p className="text-muted-foreground ml-auto text-sm tabular-nums" aria-live="polite">
            <span className="text-foreground font-semibold">{Math.round(total.calories)}</span>
            {targets ? ` / ${targets.calorieTarget}` : ""} kcal · P {Math.round(total.proteinG)}g ·
            C {Math.round(total.carbsG)}g · F {Math.round(total.fatG)}g
          </p>
        )}
      </div>

      {/* Entry modes */}
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue={mode}>
            <TabsList className="w-full justify-start">
              <TabsTrigger value="quick">Quick add</TabsTrigger>
              <TabsTrigger value="search">Search</TabsTrigger>
              <TabsTrigger value="barcode">Barcode</TabsTrigger>
              <TabsTrigger value="photo">Photo (AI)</TabsTrigger>
              <TabsTrigger value="manual">Manual</TabsTrigger>
            </TabsList>

            <TabsContent value="quick" className="pt-4">
              <QuickAdd
                date={date}
                dateIsToday={dateIsToday}
                defaultMeal={defaultMeal}
                onChanged={invalidateDay}
              />
            </TabsContent>

            <TabsContent value="search" className="pt-4">
              <FoodSearch
                onSelect={(food, source) => setDialogFood({ food, source })}
              />
            </TabsContent>

            <TabsContent value="barcode" className="pt-4">
              <BarcodePanel onFound={(food) => setDialogFood({ food, source: "barcode" })} />
            </TabsContent>

            <TabsContent value="photo" className="pt-4">
              <PhotoPanel defaultMeal={defaultMeal === "custom" ? "lunch" : defaultMeal} onChanged={invalidateDay} />
            </TabsContent>

            <TabsContent value="manual" className="pt-4">
              <CustomFoodForm
                onCreated={(food) => setDialogFood({ food, source: "manual" })}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Day entries */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Entries for this day</h2>
        {dayQuery.isPending ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Loading day…
          </p>
        ) : dayQuery.isError ? (
          <p className="text-destructive text-sm">
            Could not load this day.{" "}
            <button
              type="button"
              className="underline underline-offset-4"
              onClick={() => void dayQuery.refetch()}>
              Retry
            </button>
          </p>
        ) : (
          <DayLogs summary={summary!} onChanged={invalidateDay} />
        )}
      </div>

      <LogFoodDialog
        food={dialogFood?.food ?? null}
        open={dialogFood != null}
        onOpenChange={(o) => {
          if (!o) setDialogFood(null);
        }}
        date={date}
        dateIsToday={dateIsToday}
        defaultMeal={defaultMeal}
        source={dialogFood?.source ?? "search"}
        onLogged={invalidateDay}
      />
    </div>
  );
}
