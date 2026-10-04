"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { addWeightAction } from "@/app/app/actions/goals";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProgressSummary } from "@/lib/progress/service";

function dayTick(d: string): string {
  return d.slice(5); // MM-DD
}

function StatCard({
  label,
  value,
  sub
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-muted-foreground text-xs font-medium">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        {sub && <p className="text-muted-foreground mt-0.5 text-xs">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export function ProgressView({
  summary,
  today
}: {
  summary: ProgressSummary;
  today: string;
}) {
  const router = useRouter();
  const [weightKg, setWeightKg] = useState("");
  const [entryDate, setEntryDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { weight, intake, goal, adherence } = summary;
  const hasWeight = weight.series.length > 0;
  const hasIntake = intake.daysLogged > 0;

  async function addWeight(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const kg = Number(weightKg);
    if (!Number.isFinite(kg) || kg < 20 || kg > 400) {
      setError("Enter a weight between 20 and 400 kg.");
      return;
    }
    setSaving(true);
    const res = await addWeightAction({ weightKg: kg, entryDate });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      toast.error(res.error);
      return;
    }
    setWeightKg("");
    toast.success("Weight saved");
    router.refresh();
  }

  const change = weight.changeKg;
  const trend = weight.weeklyTrendKg;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>
        <p className="text-muted-foreground text-sm">
          Last {summary.days} days · weight trend and intake versus targets
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Latest weight"
          value={weight.latestKg != null ? `${weight.latestKg.toFixed(1)} kg` : "—"}
          sub={
            change != null
              ? `${change > 0 ? "+" : ""}${change.toFixed(1)} kg over ${summary.days}d`
              : "Log weight to see change"
          }
        />
        <StatCard
          label="Weekly trend"
          value={trend != null ? `${trend > 0 ? "+" : ""}${trend.toFixed(2)} kg/wk` : "—"}
          sub={
            goal?.target_weight_kg != null && weight.latestKg != null
              ? `Target ${goal.target_weight_kg} kg`
              : undefined
          }
        />
        <StatCard
          label="Avg calories"
          value={intake.avgCalories != null ? `${intake.avgCalories}` : "—"}
          sub={goal ? `Target ${goal.calorie_target} kcal` : undefined}
        />
        <StatCard
          label="Avg protein"
          value={intake.avgProteinG != null ? `${intake.avgProteinG} g` : "—"}
          sub={
            adherence
              ? `${adherence.pct}% of days within target (${adherence.daysWithinCalorieTarget}/${adherence.daysLogged})`
              : goal
                ? `Target ${goal.protein_target_g} g`
                : undefined
          }
        />
      </div>

      {/* Weight chart + form */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Weight</CardTitle>
          </CardHeader>
          <CardContent>
            {hasWeight ? (
              <div className="h-64" role="img" aria-label="Weight over time chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weight.series} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                    <XAxis dataKey="date" tickFormatter={dayTick} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      domain={["dataMin - 2", "dataMax + 2"]}
                      width={52}
                    />
                    <Tooltip
                      formatter={(v) => [`${Number(v).toFixed(1)} kg`, ""]}
                      labelFormatter={(l) => `Date: ${l}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="weightKg"
                      name="Weight"
                      dot={{ r: 2 }}
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="averageKg"
                      name="7-day avg"
                      dot={false}
                      stroke="var(--chart-2)"
                      strokeWidth={2}
                      strokeDasharray="5 4"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-muted-foreground py-10 text-center text-sm">
                No weight entries yet — add your first one.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Log weight</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={addWeight} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="weight-kg">Weight (kg)</Label>
                <Input
                  id="weight-kg"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min={20}
                  max={400}
                  placeholder="70.5"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weight-date">Date</Label>
                <Input
                  id="weight-date"
                  type="date"
                  value={entryDate}
                  max={today}
                  onChange={(e) => setEntryDate(e.target.value)}
                />
              </div>
              {error && (
                <p role="alert" className="text-destructive text-sm">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Saving…" : "Save weight"}
              </Button>
              <p className="text-muted-foreground text-xs">
                Weigh yourself at the same time of day (morning works best) for a smoother trend.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Intake chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily calories</CardTitle>
        </CardHeader>
        <CardContent>
          {hasIntake ? (
            <div className="h-64" role="img" aria-label="Daily calorie intake chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={intake.perDay} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                  <XAxis dataKey="date" tickFormatter={dayTick} fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} width={52} />
                  <Tooltip
                    formatter={(v, name) => [
                      `${Math.round(Number(v))} ${name === "Protein" ? "g" : "kcal"}`,
                      name
                    ]}
                    cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                  />
                  {goal && (
                    <ReferenceLine
                      y={goal.calorie_target}
                      stroke="var(--destructive)"
                      strokeDasharray="4 4"
                      label={{ value: "target", position: "insideTopRight", fontSize: 10, fill: "var(--muted-foreground)" }}
                    />
                  )}
                  <Bar dataKey="calories" name="Calories" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-muted-foreground py-10 text-center text-sm">
              Log some food and your intake history will show up here.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
