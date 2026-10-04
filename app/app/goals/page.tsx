import { getUserContext } from "@/lib/auth/session";
import { getActiveGoal } from "@/lib/goals/service";
import { GoalsView, type GoalsViewData } from "@/components/goals/goals-view";

export const metadata = { title: "Goals" };

export default async function GoalsPage() {
  const ctx = await getUserContext();
  if (!ctx) return null; // layout redirects

  const [goal, profileRaw] = await Promise.all([
    getActiveGoal(ctx.supabase, ctx.userId),
    ctx.supabase
      .from("profiles")
      .select("activity_level, current_weight_kg, height_cm, sex, date_of_birth")
      .eq("id", ctx.userId)
      .maybeSingle()
  ]);

  const p = (profileRaw.data ?? null) as Record<string, unknown> | null;

  const data: GoalsViewData = {
    goal: goal
      ? {
          goalType: goal.goal_type,
          calorieTarget: goal.calorie_target,
          proteinTargetG: goal.protein_target_g,
          carbTargetG: goal.carb_target_g,
          fatTargetG: goal.fat_target_g,
          targetWeightKg: goal.target_weight_kg,
          targetRatePerWeek: goal.target_rate_per_week,
          startDate: goal.start_date
        }
      : null,
    profile: {
      activityLevel: p?.activity_level == null ? null : String(p.activity_level),
      currentWeightKg: p?.current_weight_kg == null ? null : Number(p.current_weight_kg),
      heightCm: p?.height_cm == null ? null : Number(p.height_cm),
      sex: p?.sex == null ? null : String(p.sex),
      dateOfBirth: p?.date_of_birth == null ? null : String(p.date_of_birth)
    }
  };

  return <GoalsView data={data} />;
}
