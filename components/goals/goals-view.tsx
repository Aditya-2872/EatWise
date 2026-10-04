"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateGoalAction } from "@/app/app/actions/goals";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface GoalsViewData {
  goal: {
    goalType: string;
    calorieTarget: number;
    proteinTargetG: number;
    carbTargetG: number;
    fatTargetG: number;
    targetWeightKg: number | null;
    targetRatePerWeek: number | null;
    startDate: string;
  } | null;
  profile: {
    activityLevel: string | null;
    currentWeightKg: number | null;
    heightCm: number | null;
    sex: string | null;
    dateOfBirth: string | null;
  };
}

const GOAL_OPTIONS = [
  { value: "lose_weight", label: "Lose weight", hint: "Steady calorie deficit" },
  { value: "maintain", label: "Maintain", hint: "Hold current weight" },
  { value: "build_muscle", label: "Build muscle", hint: "Surplus + high protein" },
  { value: "gain_weight", label: "Gain weight", hint: "Calorie surplus" },
  { value: "recomposition", label: "Recomposition", hint: "Lose fat, gain muscle" },
  { value: "improve_nutrition", label: "Eat better", hint: "Balance over calories" }
] as const;

const ACTIVITY_OPTIONS = [
  { value: "sedentary", label: "Sedentary" },
  { value: "light", label: "Lightly active" },
  { value: "moderate", label: "Moderately active" },
  { value: "active", label: "Very active" },
  { value: "very_active", label: "Extremely active" }
] as const;

function Chip({
  selected,
  label,
  hint,
  onClick
}: {
  selected: boolean;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "rounded-xl border p-3 text-left transition-colors",
        selected ? "border-primary bg-primary/5 ring-primary/30 ring-2" : "hover:bg-accent/50 border-input"
      )}>
      <span className="block text-sm font-medium">{label}</span>
      {hint && <span className="text-muted-foreground block text-xs">{hint}</span>}
    </button>
  );
}

export function GoalsView({ data }: { data: GoalsViewData }) {
  const router = useRouter();
  const [goalType, setGoalType] = useState(data.goal?.goalType ?? "maintain");
  const [activityLevel, setActivityLevel] = useState(data.profile.activityLevel ?? "light");
  const [targetWeight, setTargetWeight] = useState(
    data.goal?.targetWeightKg != null ? String(data.goal.targetWeightKg) : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsTargetWeight = ["lose_weight", "gain_weight", "recomposition"].includes(goalType);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const tw = targetWeight.trim() === "" ? null : Number(targetWeight);
    if (tw != null && (!Number.isFinite(tw) || tw < 30 || tw > 300)) {
      setError("Target weight must be between 30 and 300 kg.");
      return;
    }
    setSaving(true);
    const res = await updateGoalAction({
      goalType,
      activityLevel,
      targetWeightKg: tw
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      toast.error(res.error);
      return;
    }
    toast.success("Goal updated — targets recomputed");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Goals & targets</h1>
        <p className="text-muted-foreground text-sm">
          Targets are computed with Mifflin-St Jeor and safety floors — never by AI.
        </p>
      </div>

      {data.goal && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current targets</CardTitle>
            <CardDescription>
              Active since {data.goal.startDate} · goal: {data.goal.goalType.replaceAll("_", " ")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
              {[
                { label: "Calories", value: `${data.goal.calorieTarget}`, unit: "kcal/day" },
                { label: "Protein", value: `${data.goal.proteinTargetG}`, unit: "g/day" },
                { label: "Carbs", value: `${data.goal.carbTargetG}`, unit: "g/day" },
                { label: "Fat", value: `${data.goal.fatTargetG}`, unit: "g/day" }
              ].map((t) => (
                <div key={t.label} className="bg-muted/60 rounded-xl p-3">
                  <p className="text-xl font-semibold tabular-nums">{t.value}</p>
                  <p className="text-muted-foreground text-xs">
                    {t.label} · {t.unit}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <form onSubmit={save} className="space-y-6" noValidate>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Primary goal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {GOAL_OPTIONS.map((o) => (
                <Chip
                  key={o.value}
                  label={o.label}
                  hint={o.hint}
                  selected={goalType === o.value}
                  onClick={() => setGoalType(o.value)}
                />
              ))}
            </div>
            {needsTargetWeight && (
              <div className="mt-4 max-w-56 space-y-2">
                <Label htmlFor="goal-target-weight">Target weight (kg)</Label>
                <Input
                  id="goal-target-weight"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min={30}
                  max={300}
                  value={targetWeight}
                  onChange={(e) => setTargetWeight(e.target.value)}
                  placeholder={data.profile.currentWeightKg != null ? String(data.profile.currentWeightKg) : "65"}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activity level</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              {ACTIVITY_OPTIONS.map((o) => (
                <Chip
                  key={o.value}
                  label={o.label}
                  selected={activityLevel === o.value}
                  onClick={() => setActivityLevel(o.value)}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? "Recomputing…" : "Save goal & recompute targets"}
          </Button>
        </div>
      </form>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile used for targets</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-1 text-sm">
          <p>Sex: {data.profile.sex ?? "—"} · Born: {data.profile.dateOfBirth ?? "—"}</p>
          <p>
            Height: {data.profile.heightCm != null ? `${data.profile.heightCm} cm` : "—"} · Weight:{" "}
            {data.profile.currentWeightKg != null ? `${data.profile.currentWeightKg} kg` : "—"}
          </p>
          <p className="text-xs">
            Update these in onboarding data via Settings. Weight updates automatically when you log
            a new weight on the Progress page.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
