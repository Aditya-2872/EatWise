import { getUserContext } from "@/lib/auth/session";
import { getDailySummary } from "@/lib/logging/service";
import { todayLocalDateStr } from "@/lib/nutrition/daily";
import { MealsView } from "@/components/meals/meals-view";

export const metadata = { title: "Meals" };

interface PageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function MealsPage({ searchParams }: PageProps) {
  const ctx = await getUserContext();
  if (!ctx) return null; // layout redirects

  const params = await searchParams;
  const today = todayLocalDateStr(ctx.timeZone);

  const date =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) && params.date <= today
      ? params.date
      : today;

  const summary = await getDailySummary(ctx.supabase, ctx.userId, date);

  return <MealsView initialSummary={summary} initialDate={date} today={today} />;
}
