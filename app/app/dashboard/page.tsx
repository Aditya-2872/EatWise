import { getUserContext } from "@/lib/auth/session";
import { getDailySummary } from "@/lib/logging/service";
import { todayLocalDateStr } from "@/lib/nutrition/daily";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const ctx = await getUserContext();
  if (!ctx) return null; // layout already redirects; guard for type-safety

  const today = todayLocalDateStr(ctx.timeZone);
  const summary = await getDailySummary(ctx.supabase, ctx.userId, today);

  const dateLabel = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: ctx.timeZone
  }).format(new Date());

  return <DashboardView summary={summary} dateLabel={dateLabel} today={today} />;
}
