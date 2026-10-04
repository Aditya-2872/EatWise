/**
 * Timezone-correct local-day helpers (spec §18 "handle timezone correctly",
 * §38 time edge cases: DST, midnight crossing, travel).
 */

import { MEAL_TIME_RANGES } from "@/lib/constants/nutrition";
import type { MealType } from "@/types/nutrition";

/** Minutes the given timezone is ahead of UTC at a specific instant. */
export function tzOffsetMinutes(timeZone: string, atUtc: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(atUtc).map((p) => [p.type, p.value]),
  );
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asIfUtc - atUtc.getTime()) / 60000);
}

/**
 * UTC instant range [start, end) covering one local calendar day
 * (YYYY-MM-DD) in the given timezone. DST-safe: each boundary is resolved
 * with the offset in effect at that boundary.
 */
export function localDayRangeUtc(
  timeZone: string,
  localDate: string,
): { startIso: string; endIso: string } {
  const [y, m, d] = localDate.split("-").map(Number);
  if (!y || !m || !d) {
    throw new Error(`Invalid local date: ${localDate} (expected YYYY-MM-DD)`);
  }

  const startGuess = Date.UTC(y, m - 1, d, 0, 0, 0);
  const start =
    startGuess - tzOffsetMinutes(timeZone, new Date(startGuess)) * 60_000;

  const endGuess = Date.UTC(y, m - 1, d + 1, 0, 0, 0);
  const end = endGuess - tzOffsetMinutes(timeZone, new Date(endGuess)) * 60_000;

  return {
    startIso: new Date(start).toISOString(),
    endIso: new Date(end).toISOString(),
  };
}

/** Today's date as YYYY-MM-DD in the user's timezone. */
export function todayLocalDateStr(timeZone: string, now = new Date()): string {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return dtf.format(now); // en-CA → YYYY-MM-DD
}

/** Local hour (0-23) of an instant in a timezone. */
export function localHour(timeZone: string, at: Date = new Date()): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    hour: "2-digit",
  });
  return Number(dtf.format(at)) % 24;
}

/** Preselect meal type from local time of day. */
export function inferMealType(hourLocal: number): MealType {
  const h = hourLocal % 24;
  for (const [meal, [from, to]] of Object.entries(MEAL_TIME_RANGES)) {
    if (to > 24) {
      // Wraps past midnight (dinner 18 → 4am).
      if (h >= from || h < to - 24) return meal as MealType;
    } else if (h >= from && h < to) {
      return meal as MealType;
    }
  }
  return "snack";
}
