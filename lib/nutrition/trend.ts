/**
 * Weight trend math (spec §21): moving average + weekly rate of change.
 * Pure deterministic functions over time-ordered weight entries.
 */

import type { WeightEntry } from "@/types/nutrition";

type Point = { dayMs: number; weightKg: number };

function toPoints(entries: WeightEntry[]): Point[] {
  return entries
    .map((e) => ({
      dayMs: startOfDayUtc(new Date(e.recordedAt)).getTime(),
      weightKg: Number(e.weightKg),
    }))
    .filter((p) => Number.isFinite(p.weightKg))
    .sort((a, b) => a.dayMs - b.dayMs);
}

function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Centered moving average over a day-window. For each entry, averages all
 * entries within ±windowDays/2 (duplicates within a day averaged first).
 */
export function movingAverageSeries(
  entries: WeightEntry[],
  windowDays = 7,
): { date: string; weightKg: number; averageKg: number }[] {
  const points = dedupeByDay(toPoints(entries));
  const half = Math.floor(windowDays / 2) * 86_400_000;

  return points.map((p) => {
    const inWindow = points.filter((q) => Math.abs(q.dayMs - p.dayMs) <= half);
    const avg =
      inWindow.reduce((s, q) => s + q.weightKg, 0) / (inWindow.length || 1);
    return {
      date: new Date(p.dayMs).toISOString().slice(0, 10),
      weightKg: round1(p.weightKg),
      averageKg: round1(avg),
    };
  });
}

/**
 * Trend over the last `days`: least-squares slope of the moving-average
 * series, expressed in kg per week. Returns null with < 2 distinct days.
 */
export function weeklyTrendKg(
  entries: WeightEntry[],
  days = 28,
  windowDays = 7,
): number | null {
  const cutoff = Date.now() - days * 86_400_000;
  const series = movingAverageSeries(
    entries.filter((e) => new Date(e.recordedAt).getTime() >= cutoff),
    windowDays,
  );
  if (series.length < 2) return null;

  const n = series.length;
  const xs = series.map((_, i) => i);
  const ys = series.map((s) => s.averageKg);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  if (den === 0) return null;

  // Points are ~evenly spaced across `days`; convert slope to kg/week.
  const daysSpan =
    (new Date(series[n - 1].date).getTime() -
      new Date(series[0].date).getTime()) /
    86_400_000;
  if (daysSpan <= 0) return null;
  const slopePerDay = num / den / (n / daysSpan || 1);
  return round1(slopePerDay * 7);
}

/** Simple change: latest − earliest within the window. */
export function changeOverPeriodKg(
  entries: WeightEntry[],
  days = 28,
): number | null {
  const cutoff = Date.now() - days * 86_400_000;
  const points = dedupeByDay(
    toPoints(entries.filter((e) => new Date(e.recordedAt).getTime() >= cutoff)),
  );
  if (points.length < 2) return null;
  return round1(points[points.length - 1].weightKg - points[0].weightKg);
}

function dedupeByDay(points: Point[]): Point[] {
  const byDay = new Map<number, number[]>();
  for (const p of points) {
    const list = byDay.get(p.dayMs) ?? [];
    list.push(p.weightKg);
    byDay.set(p.dayMs, list);
  }
  return [...byDay.entries()]
    .map(([dayMs, vals]) => ({
      dayMs,
      weightKg: vals.reduce((a, b) => a + b, 0) / vals.length,
    }))
    .sort((a, b) => a.dayMs - b.dayMs);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
