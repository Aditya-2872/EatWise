import { getUserContext } from "@/lib/auth/session";
import { listCustomFoods } from "@/lib/foods/repository";
import { todayLocalDateStr } from "@/lib/nutrition/daily";
import { FoodExplorer } from "@/components/food/food-explorer";
import type { MealType } from "@/types/nutrition";

export const metadata = { title: "Foods" };

/** Deterministic default meal from the user's local hour (no AI involved). */
function suggestedMeal(timeZone: string): MealType {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date()).find((p) => p.type === "hour")?.value ?? "8",
  );
  if (hour >= 4 && hour < 10) return "breakfast";
  if (hour >= 10 && hour < 15) return "lunch";
  if (hour >= 15 && hour < 17) return "snack";
  if (hour >= 17 && hour < 22) return "dinner";
  return "snack";
}

export default async function FoodPage() {
  const ctx = await getUserContext();
  if (!ctx) return null; // layout redirects

  const today = todayLocalDateStr(ctx.timeZone);
  const customFoods = await listCustomFoods(ctx.supabase, ctx.userId);

  return (
    <FoodExplorer
      today={today}
      defaultMeal={suggestedMeal(ctx.timeZone)}
      initialCustomFoods={customFoods}
    />
  );
}
