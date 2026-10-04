import { getUserContext } from "@/lib/auth/session";
import { getDailySummary } from "@/lib/logging/service";
import { todayLocalDateStr } from "@/lib/nutrition/daily";
import { LogView } from "@/components/logging/log-view";
import { MEAL_TYPES } from "@/lib/validation/logging";
import type { MealType } from "@/types/nutrition";

export const metadata = { title: "Log food" };

interface PageProps {
  searchParams: Promise<{ date?: string; meal?: string; mode?: string }>;
}

export default async function LogPage({ searchParams }: PageProps) {
  const ctx = await getUserContext();
  if (!ctx) return null; // layout redirects

  const params = await searchParams;
  const today = todayLocalDateStr(ctx.timeZone);

  const date =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) && params.date <= today
      ? params.date
      : today;
  const meal = (MEAL_TYPES as readonly string[]).includes(params.meal ?? "")
    ? (params.meal as MealType)
    : "breakfast";
  const mode = params.mode ?? "search";

  const summary = await getDailySummary(ctx.supabase, ctx.userId, date);

  return (
    <LogView
      initialSummary={summary}
      initialDate={date}
      today={today}
      defaultMeal={meal}
      defaultMode={mode}
    />
  );
}
