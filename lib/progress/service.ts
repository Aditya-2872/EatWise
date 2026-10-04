/**
 * Progress service (spec §21): weight trend + intake history + adherence.
 * All math is deterministic typed code (lib/nutrition/trend.ts), never an LLM.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { WeightEntry } from "@/types/nutrition";
import {
  changeOverPeriodKg,
  movingAverageSeries,
  weeklyTrendKg,
} from "@/lib/nutrition/trend";
import { localDayRangeUtc, todayLocalDateStr } from "@/lib/nutrition/daily";
import { getActiveGoal, type ActiveGoalRow } from "@/lib/goals/service";

type Raw = Record<string, unknown>;

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function mapWeightRow(raw: Raw): WeightEntry {
  return {
    id: String(raw.id),
    weightKg: num(raw.weight_kg),
    recordedAt: String(raw.recorded_at),
    source: String(raw.source ?? "manual"),
    notes: raw.notes == null ? null : String(raw.notes),
  };
}

/* ------------------------------------------------------------------ */
/* Weight entries                                                      */
/* ------------------------------------------------------------------ */

export async function listWeightEntries(
  supabase: SupabaseClient,
  userId: string,
  days = 90,
): Promise<WeightEntry[]> {
  const sinceIso = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("weight_entries")
    .select("*")
    .eq("user_id", userId)
    .gte("recorded_at", sinceIso)
    .order("recorded_at", { ascending: true });
  if (error) {
    console.error("[progress] weight query failed:", error.message);
    return [];
  }
  return ((data ?? []) as Raw[]).map(mapWeightRow);
}

export interface AddWeightInput {
  weightKg: number;
  recordedAt?: string;
  notes?: string | null;
  source?: "manual" | "import" | "onboarding";
}

export async function addWeightEntry(
  supabase: SupabaseClient,
  userId: string,
  input: AddWeightInput,
): Promise<WeightEntry | null> {
  const recordedAt =
    input.recordedAt && !Number.isNaN(Date.parse(input.recordedAt))
      ? new Date(input.recordedAt)
      : new Date();

  const { data, error } = await supabase
    .from("weight_entries")
    .insert({
      user_id: userId,
      weight_kg: input.weightKg,
      recorded_at: recordedAt.toISOString(),
      source: input.source ?? "manual",
      notes: input.notes ?? null,
    })
    .select("*")
    .single();
  if (error || !data) {
    console.error("[progress] weight insert failed:", error?.message);
    return null;
  }

  // Keep the profile's current weight in sync (best effort).
  await supabase
    .from("profiles")
    .update({ current_weight_kg: input.weightKg })
    .eq("id", userId)
    .then(({ error: e }) => {
      if (e) console.error("[progress] profile weight sync failed:", e.message);
    });

  return mapWeightRow(data as Raw);
}

/* ------------------------------------------------------------------ */
/* Multi-day intake history                                            */
/* ------------------------------------------------------------------ */

export interface DayIntakePoint {
  date: string; // YYYY-MM-DD local
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  logCount: number;
}

function localDateFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function shiftLocalDate(dateStr: string, deltaDays: number): string {
  const t = Date.parse(`${dateStr}T00:00:00Z`);
  return new Date(t + deltaDays * 86_400_000).toISOString().slice(0, 10);
}

/** Per-local-day calorie/macro totals for the last `days` days (inclusive of today). */
export async function getIntakeHistory(
  supabase: SupabaseClient,
  userId: string,
  timeZone: string,
  days: number,
): Promise<DayIntakePoint[]> {
  const today = todayLocalDateStr(timeZone);
  const startDate = shiftLocalDate(today, -(days - 1));
  const { startIso } = localDayRangeUtc(timeZone, startDate);
  const { endIso } = localDayRangeUtc(timeZone, today);

  const { data, error } = await supabase
    .from("food_logs")
    .select("logged_at, nutrition_snapshot")
    .eq("user_id", userId)
    .gte("logged_at", startIso)
    .lt("logged_at", endIso);
  if (error) {
    console.error("[progress] intake history query failed:", error.message);
    return [];
  }

  const fmt = localDateFormatter(timeZone);
  const byDate = new Map<string, DayIntakePoint>();
  // Pre-seed every day in range so charts get a continuous x-axis.
  for (let i = 0; i < days; i++) {
    const d = shiftLocalDate(startDate, i);
    byDate.set(d, { date: d, calories: 0, proteinG: 0, carbsG: 0, fatG: 0, logCount: 0 });
  }

  for (const row of (data ?? []) as Raw[]) {
    const at = new Date(String(row.logged_at));
    if (Number.isNaN(at.getTime())) continue;
    const key = fmt.format(at);
    const point = byDate.get(key);
    if (!point) continue;
    const snap = (row.nutrition_snapshot && typeof row.nutrition_snapshot === "object"
      ? row.nutrition_snapshot
      : {}) as Raw;
    point.calories += num(snap.calories);
    point.proteinG += num(snap.proteinG);
    point.carbsG += num(snap.carbsG);
    point.fatG += num(snap.fatG);
    point.logCount += 1;
  }

  return [...byDate.values()]
    .map((p) => ({
      ...p,
      calories: Math.round(p.calories),
      proteinG: Math.round(p.proteinG),
      carbsG: Math.round(p.carbsG),
      fatG: Math.round(p.fatG),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/* ------------------------------------------------------------------ */
/* Combined summary                                                    */
/* ------------------------------------------------------------------ */

export interface ProgressSummary {
  days: number;
  weight: {
    entries: WeightEntry[];
    series: { date: string; weightKg: number; averageKg: number }[];
    latestKg: number | null;
    changeKg: number | null;
    weeklyTrendKg: number | null;
  };
  intake: {
    perDay: DayIntakePoint[];
    daysLogged: number;
    avgCalories: number | null;
    avgProteinG: number | null;
  };
  goal: Pick<
    ActiveGoalRow,
    "goal_type" | "calorie_target" | "protein_target_g" | "carb_target_g" | "fat_target_g" | "target_weight_kg"
  > | null;
  adherence: {
    daysLogged: number;
    daysWithinCalorieTarget: number;
    pct: number | null;
  } | null;
}

/** Within-target = day total between 90% and 105% of the calorie target. */
const ADHERENCE_LOW = 0.9;
const ADHERENCE_HIGH = 1.05;

export async function getProgressSummary(
  supabase: SupabaseClient,
  userId: string,
  timeZone: string,
  days = 28,
): Promise<ProgressSummary> {
  const clampedDays = Math.max(7, Math.min(days, 90));

  const [entries, perDay, goal] = await Promise.all([
    listWeightEntries(supabase, userId, Math.max(clampedDays, 90)),
    getIntakeHistory(supabase, userId, timeZone, clampedDays),
    getActiveGoal(supabase, userId),
  ]);

  const loggedDays = perDay.filter((p) => p.logCount > 0);
  const avgCalories =
    loggedDays.length > 0
      ? Math.round(loggedDays.reduce((s, p) => s + p.calories, 0) / loggedDays.length)
      : null;
  const avgProteinG =
    loggedDays.length > 0
      ? Math.round(loggedDays.reduce((s, p) => s + p.proteinG, 0) / loggedDays.length)
      : null;

  let adherence: ProgressSummary["adherence"] = null;
  if (goal && loggedDays.length > 0) {
    const target = goal.calorie_target;
    const within = loggedDays.filter(
      (p) => p.calories >= target * ADHERENCE_LOW && p.calories <= target * ADHERENCE_HIGH,
    ).length;
    adherence = {
      daysLogged: loggedDays.length,
      daysWithinCalorieTarget: within,
      pct: Math.round((within / loggedDays.length) * 100),
    };
  }

  return {
    days: clampedDays,
    weight: {
      entries,
      series: movingAverageSeries(entries, 7),
      latestKg: entries.length > 0 ? entries[entries.length - 1].weightKg : null,
      changeKg: changeOverPeriodKg(entries, clampedDays),
      weeklyTrendKg: weeklyTrendKg(entries, clampedDays),
    },
    intake: {
      perDay,
      daysLogged: loggedDays.length,
      avgCalories,
      avgProteinG,
    },
    goal: goal
      ? {
          goal_type: goal.goal_type,
          calorie_target: goal.calorie_target,
          protein_target_g: goal.protein_target_g,
          carb_target_g: goal.carb_target_g,
          fat_target_g: goal.fat_target_g,
          target_weight_kg: goal.target_weight_kg,
        }
      : null,
    adherence,
  };
}
