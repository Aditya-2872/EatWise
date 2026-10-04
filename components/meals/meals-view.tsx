"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, Plus } from "lucide-react";

import { DayLogs } from "@/components/logging/day-logs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DaySummary } from "@/lib/logging/service";

function shiftDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

export interface MealsViewProps {
  initialSummary: DaySummary;
  initialDate: string;
  today: string;
}

export function MealsView({ initialSummary, initialDate, today }: MealsViewProps) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(initialDate);

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
  const total = summary?.intake.total;
  const targets = summary?.targets;

  function invalidateDay() {
    void queryClient.invalidateQueries({ queryKey: ["day", date] });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Meals</h1>
          <p className="text-muted-foreground text-sm">
            Everything logged on this day, grouped by meal.
          </p>
        </div>
        <Button size="sm" render={<Link href={`/app/log?date=${date}`} />}>
          <Plus aria-hidden />
          Add food
        </Button>
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
          aria-label="View day"
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
        {date !== today && (
          <Button variant="ghost" size="sm" onClick={() => setDate(today)}>
            Today
          </Button>
        )}
      </div>

      {/* Day totals */}
      {total && (
        <div className="rounded-xl border p-4">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <p className="text-2xl font-semibold tabular-nums" aria-live="polite">
              {Math.round(total.calories)}
              {targets ? (
                <span className="text-muted-foreground text-base font-normal">
                  {" "}
                  / {targets.calorieTarget} kcal
                </span>
              ) : (
                <span className="text-muted-foreground text-base font-normal"> kcal</span>
              )}
            </p>
            {targets && (
              <p className="text-muted-foreground text-sm tabular-nums">
                {Math.round(targets.calorieTarget - total.calories) >= 0
                  ? `${Math.round(targets.calorieTarget - total.calories)} kcal left`
                  : `${Math.round(total.calories - targets.calorieTarget)} kcal over`}
              </p>
            )}
            <p className="text-muted-foreground ml-auto text-sm tabular-nums">
              P {Math.round(total.proteinG)}g · C {Math.round(total.carbsG)}g · F{" "}
              {Math.round(total.fatG)}g
            </p>
          </div>
        </div>
      )}

      {/* Meal groups */}
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
  );
}
