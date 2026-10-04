import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { recentFoods } from "@/lib/foods/repository";
import { getDailySummary } from "@/lib/logging/service";
import { todayLocalDateStr } from "@/lib/nutrition/daily";
import { getProgressSummary } from "@/lib/progress/service";

/**
 * Deterministic context builders for the guidance / meal-plan prompts.
 * Every number here comes from the nutrition engine or the database —
 * the LLM only reads this JSON, it never produces these figures
 * (spec §18: no LLM arithmetic).
 */

export function localHour(timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  return Number(parts.find((p) => p.type === "hour")?.value ?? "12");
}

const r = (n: number) => Math.round(n);

export interface AiDayContext {
  today: string;
  hour: number;
  day: Awaited<ReturnType<typeof getDailySummary>>;
  progress: Awaited<ReturnType<typeof getProgressSummary>>;
}

export async function loadDayContext(
  supabase: SupabaseClient,
  userId: string,
  timeZone: string,
): Promise<AiDayContext> {
  const today = todayLocalDateStr(timeZone);
  const [day, progress] = await Promise.all([
    getDailySummary(supabase, userId, today),
    getProgressSummary(supabase, userId, timeZone, 28),
  ]);
  return { today, hour: localHour(timeZone), day, progress };
}

/** Compact JSON context for the guidance coach (spec §19 structured access). */
export function buildGuidanceContext(c: AiDayContext): string {
  const { day, progress } = c;
  const total = day.intake.total;
  const targets = day.targets;

  return JSON.stringify({
    localDate: c.today,
    localHour: c.hour,
    profile: day.profile
      ? {
          displayName: day.profile.displayName,
          sex: day.profile.sex,
          heightCm: day.profile.heightCm,
          currentWeightKg: day.profile.currentWeightKg,
        }
      : null,
    goal: targets
      ? {
          type: targets.goalType,
          calorieTarget: targets.calorieTarget,
          proteinTargetG: targets.proteinTargetG,
          carbTargetG: targets.carbTargetG,
          fatTargetG: targets.fatTargetG,
        }
      : null,
    todayIntake: {
      calories: r(total.calories),
      proteinG: r(total.proteinG),
      carbsG: r(total.carbsG),
      fatG: r(total.fatG),
      fiberG: r(total.fiberG),
      loggedItems: day.intake.logs
        .slice(0, 20)
        .map((l) => `${l.meal_type}: ${l.food_name ?? l.food_id ?? "item"} (${l.quantity} ${l.unit})`),
    },
    remainingToday: targets
      ? {
          calories: r(targets.calorieTarget - total.calories),
          proteinG: r(targets.proteinTargetG - total.proteinG),
          carbsG: r(targets.carbTargetG - total.carbsG),
          fatG: r(targets.fatTargetG - total.fatG),
        }
      : null,
    last28Days: {
      daysLogged: progress.intake.daysLogged,
      avgCalories: progress.intake.avgCalories,
      avgProteinG: progress.intake.avgProteinG,
      calorieAdherencePct: progress.adherence?.pct ?? null,
    },
    weight: {
      latestKg: progress.weight.latestKg,
      change28dKg: progress.weight.changeKg,
      weeklyTrendKg: progress.weight.weeklyTrendKg,
      targetKg: progress.goal?.target_weight_kg ?? null,
    },
  });
}

/** Remaining meal slots for today, deterministically from the local hour. */
export function defaultMealSlots(hour: number): ("breakfast" | "lunch" | "dinner" | "snack")[] {
  if (hour < 10) return ["breakfast", "lunch", "dinner"];
  if (hour < 14) return ["lunch", "dinner"];
  if (hour < 17) return ["snack", "dinner"];
  if (hour < 21) return ["dinner"];
  return ["breakfast"]; // late night → plan tomorrow's breakfast
}

/** Compact JSON context for the next-meal planner (spec §5 Next-Meal Intelligence). */
export async function buildMealPlanContext(
  supabase: SupabaseClient,
  userId: string,
  c: AiDayContext,
): Promise<string> {
  const { day } = c;
  const total = day.intake.total;
  const targets = day.targets;
  const frequent = await recentFoods(supabase, userId, 12);

  return JSON.stringify({
    localDate: c.today,
    localHour: c.hour,
    goal: targets ? { type: targets.goalType } : null,
    remainingToday: targets
      ? {
          calories: Math.max(0, r(targets.calorieTarget - total.calories)),
          proteinG: Math.max(0, r(targets.proteinTargetG - total.proteinG)),
          carbsG: Math.max(0, r(targets.carbTargetG - total.carbsG)),
          fatG: Math.max(0, r(targets.fatTargetG - total.fatG)),
        }
      : null,
    alreadyLoggedToday: day.intake.logs
      .slice(0, 15)
      .map((l) => `${l.meal_type}: ${l.food_name ?? "item"}`),
    frequentFoods: frequent.map((f) => ({
      name: f.custom_name ?? f.name,
      usual: f.usual_quantity != null && f.usual_unit ? `${f.usual_quantity} ${f.usual_unit}` : null,
    })),
  });
}
