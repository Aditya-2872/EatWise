import { getUserContext } from "@/lib/auth/session";
import { getProgressSummary } from "@/lib/progress/service";
import { getDayIntake } from "@/lib/logging/service";
import { todayLocalDateStr } from "@/lib/nutrition/daily";
import { InsightsView, type InsightsData } from "@/components/insights/insights-view";

export const metadata = { title: "Insights" };

export default async function InsightsPage() {
  const ctx = await getUserContext();
  if (!ctx) return null; // layout redirects

  const today = todayLocalDateStr(ctx.timeZone);
  const [summary, todayIntake] = await Promise.all([
    getProgressSummary(ctx.supabase, ctx.userId, ctx.timeZone, 28),
    getDayIntake(ctx.supabase, ctx.userId, ctx.timeZone, today)
  ]);

  // Streak: consecutive days with ≥1 log, ending today or yesterday.
  const perDay = summary.intake.perDay;
  let streak = 0;
  for (let i = perDay.length - 1; i >= 0; i--) {
    const p = perDay[i];
    const isToday = p.date === today;
    if (p.logCount > 0) {
      streak++;
    } else if (!(isToday && streak === 0)) {
      // allow today to be empty only at the very start of the scan
      break;
    }
  }

  const last7 = perDay.slice(-7);
  const logged7 = last7.filter((p) => p.logCount > 0);
  const avg7Calories =
    logged7.length > 0
      ? Math.round(logged7.reduce((s, p) => s + p.calories, 0) / logged7.length)
      : null;
  const avg7Protein =
    logged7.length > 0
      ? Math.round(logged7.reduce((s, p) => s + p.proteinG, 0) / logged7.length)
      : null;

  const data: InsightsData = {
    today: {
      calories: Math.round(todayIntake.total.calories),
      proteinG: Math.round(todayIntake.total.proteinG),
      carbsG: Math.round(todayIntake.total.carbsG),
      fatG: Math.round(todayIntake.total.fatG),
      fiberG: Math.round(todayIntake.total.fiberG),
      logCount: todayIntake.logs.length
    },
    streak,
    week: { daysLogged: logged7.length, avgCalories: avg7Calories, avgProteinG: avg7Protein },
    goal: summary.goal,
    adherence: summary.adherence,
    weight: {
      latestKg: summary.weight.latestKg,
      weeklyTrendKg: summary.weight.weeklyTrendKg,
      changeKg: summary.weight.changeKg
    }
  };

  return <InsightsView data={data} />;
}
