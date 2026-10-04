import { getUserContext } from "@/lib/auth/session";
import { getProgressSummary } from "@/lib/progress/service";
import { todayLocalDateStr } from "@/lib/nutrition/daily";
import { ProgressView } from "@/components/progress/progress-view";

export const metadata = { title: "Progress" };

interface PageProps {
  searchParams: Promise<{ days?: string }>;
}

export default async function ProgressPage({ searchParams }: PageProps) {
  const ctx = await getUserContext();
  if (!ctx) return null; // layout redirects

  const params = await searchParams;
  const daysParam = Number(params.days);
  const days = Number.isFinite(daysParam) && daysParam >= 7 ? Math.min(Math.round(daysParam), 90) : 28;

  const summary = await getProgressSummary(ctx.supabase, ctx.userId, ctx.timeZone, days);
  const today = todayLocalDateStr(ctx.timeZone);

  return <ProgressView summary={summary} today={today} />;
}
