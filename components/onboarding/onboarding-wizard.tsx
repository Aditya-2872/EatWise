"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";

import { completeOnboardingAction } from "@/app/app/actions/goals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { calculateTargets } from "@/lib/nutrition/targets";
import { ageFromDob, onboardingSchema } from "@/lib/validation/goals";

/* ------------------------------------------------------------------ */
/* Step-level validation (numbers arrive as strings from inputs)       */
/* ------------------------------------------------------------------ */

const num = (min: number, max: number, msg: string) =>
  z.coerce
    .number({ message: msg })
    .min(min, msg)
    .max(max, msg);

const step1Schema = z.object({
  sex: z.enum(["male", "female", "other"]),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .refine((d) => {
      const age = ageFromDob(d);
      return age != null && age >= 13 && age <= 100;
    }, "Age must be between 13 and 100"),
});

const step2Schema = z
  .object({
    heightCm: num(120, 230, "Enter a height between 120 and 230 cm"),
    weightKg: num(30, 300, "Enter a weight between 30 and 300 kg"),
    targetWeightKg: z.string().trim().optional(),
  })
  .refine(
    (v) => v.targetWeightKg == null || v.targetWeightKg === "" || (Number(v.targetWeightKg) >= 30 && Number(v.targetWeightKg) <= 300),
    { message: "Target weight must be between 30 and 300 kg", path: ["targetWeightKg"] }
  );

const step3Schema = z.object({
  activityLevel: z.enum(["sedentary", "light", "moderate", "active", "very_active"]),
});

const step4Schema = z.object({
  goalType: z.enum([
    "lose_weight",
    "gain_weight",
    "build_muscle",
    "recomposition",
    "maintain",
    "improve_nutrition",
  ]),
  dietType: z
    .enum(["omnivore", "vegetarian", "vegan", "eggitarian", "halal"])
    .optional()
    .or(z.literal("")),
  targetRatePerWeek: z.string().trim().optional(),
});

/* ------------------------------------------------------------------ */
/* Option labels                                                       */
/* ------------------------------------------------------------------ */

const SEX_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
] as const;

const ACTIVITY_OPTIONS = [
  { value: "sedentary", label: "Sedentary", hint: "Desk job, little exercise" },
  { value: "light", label: "Lightly active", hint: "Exercise 1–3 days/week" },
  { value: "moderate", label: "Moderately active", hint: "Exercise 3–5 days/week" },
  { value: "active", label: "Very active", hint: "Exercise 6–7 days/week" },
  { value: "very_active", label: "Extremely active", hint: "Physical job + training" },
] as const;

const GOAL_OPTIONS = [
  { value: "lose_weight", label: "Lose weight", hint: "Steady calorie deficit" },
  { value: "maintain", label: "Maintain", hint: "Hold current weight" },
  { value: "build_muscle", label: "Build muscle", hint: "Surplus + high protein" },
  { value: "gain_weight", label: "Gain weight", hint: "Calorie surplus" },
  { value: "recomposition", label: "Recomposition", hint: "Lose fat, gain muscle" },
  { value: "improve_nutrition", label: "Eat better", hint: "Balance over calories" },
] as const;

const DIET_OPTIONS = [
  { value: "", label: "No preference" },
  { value: "omnivore", label: "Omnivore" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "eggitarian", label: "Eggitarian" },
  { value: "vegan", label: "Vegan" },
  { value: "halal", label: "Halal" },
] as const;

const RATE_OPTIONS = ["0.25", "0.5", "0.75", "1"] as const;

const STEP_TITLES = ["About you", "Your body", "Activity", "Your goal"] as const;

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

function ChoiceCard({
  selected,
  label,
  hint,
  onClick,
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
        selected
          ? "border-primary bg-primary/5 ring-primary/30 ring-2"
          : "hover:bg-accent/50 border-input"
      )}
    >
      <span className="block text-sm font-medium">{label}</span>
      {hint && <span className="text-muted-foreground block text-xs">{hint}</span>}
    </button>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-destructive text-sm">
      {message}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Wizard                                                              */
/* ------------------------------------------------------------------ */

interface Draft {
  sex: string;
  dateOfBirth: string;
  heightCm: string;
  weightKg: string;
  targetWeightKg: string;
  activityLevel: string;
  goalType: string;
  dietType: string;
  targetRatePerWeek: string;
}

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Draft>({
    sex: "",
    dateOfBirth: "",
    heightCm: "",
    weightKg: "",
    targetWeightKg: "",
    activityLevel: "",
    goalType: "",
    dietType: "",
    targetRatePerWeek: "0.5",
  });

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const needsTargetWeight = ["lose_weight", "gain_weight", "recomposition"].includes(draft.goalType);
  const needsRate = ["lose_weight", "gain_weight", "build_muscle"].includes(draft.goalType);

  /** Live preview of computed targets (server recomputes authoritatively). */
  const preview = useMemo(() => {
    const age = draft.dateOfBirth ? ageFromDob(draft.dateOfBirth) : null;
    const heightCm = Number(draft.heightCm);
    const weightKg = Number(draft.weightKg);
    if (
      age == null ||
      !Number.isFinite(heightCm) ||
      !Number.isFinite(weightKg) ||
      !draft.sex ||
      !draft.activityLevel ||
      !draft.goalType
    ) {
      return null;
    }
    return calculateTargets({
      sex: draft.sex as "male" | "female" | "other",
      ageYears: age,
      heightCm,
      weightKg,
      activityLevel: draft.activityLevel as never,
      goalType: draft.goalType as never,
    });
  }, [draft.sex, draft.dateOfBirth, draft.heightCm, draft.weightKg, draft.activityLevel, draft.goalType]);

  function validateStep(target: number): boolean {
    const next: Record<string, string> = {};
    if (target > 0) {
      const r1 = step1Schema.safeParse({ sex: draft.sex, dateOfBirth: draft.dateOfBirth });
      if (!r1.success) {
        const issue = r1.error.issues[0];
        next[String(issue.path[0] ?? "sex")] = issue.message;
      }
    }
    if (target > 1) {
      const r2 = step2Schema.safeParse({
        heightCm: draft.heightCm,
        weightKg: draft.weightKg,
        targetWeightKg: draft.targetWeightKg,
      });
      if (!r2.success) {
        const issue = r2.error.issues[0];
        next[String(issue.path[0] ?? "heightCm")] = issue.message;
      }
    }
    if (target > 2) {
      const r3 = step3Schema.safeParse({ activityLevel: draft.activityLevel });
      if (!r3.success) next.activityLevel = r3.error.issues[0].message;
    }
    if (target > 3) {
      const r4 = step4Schema.safeParse({
        goalType: draft.goalType,
        dietType: draft.dietType,
        targetRatePerWeek: draft.targetRatePerWeek,
      });
      if (!r4.success) {
        const issue = r4.error.issues[0];
        next[String(issue.path[0] ?? "goalType")] = issue.message;
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function nextStep() {
    if (validateStep(step + 1)) setStep((s) => Math.min(s + 1, 3));
  }

  function submit() {
    if (!validateStep(4)) return;

    const payload = {
      sex: draft.sex,
      dateOfBirth: draft.dateOfBirth,
      heightCm: Number(draft.heightCm),
      weightKg: Number(draft.weightKg),
      activityLevel: draft.activityLevel,
      goalType: draft.goalType,
      targetWeightKg: needsTargetWeight && draft.targetWeightKg ? Number(draft.targetWeightKg) : null,
      targetRatePerWeek: needsRate && draft.targetRatePerWeek ? Number(draft.targetRatePerWeek) : null,
      ...(draft.dietType ? { dietType: draft.dietType } : {}),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || undefined,
    };

    const full = onboardingSchema.safeParse(payload);
    if (!full.success) {
      setErrors({ form: full.error.issues[0].message });
      return;
    }

    startTransition(async () => {
      const res = await completeOnboardingAction(full.data);
      if (!res.ok) {
        setErrors({ form: res.error });
        toast.error(res.error);
        return;
      }
      toast.success("Profile saved — welcome to EatWise!");
      router.push("/app/dashboard");
      router.refresh();
    });
  }

  return (
    <div>
      {/* Progress */}
      <div className="mb-6" aria-label={`Step ${step + 1} of 4: ${STEP_TITLES[step]}`}>
        <div className="flex items-center gap-1.5" aria-hidden>
          {STEP_TITLES.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                i <= step ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          Step {step + 1} of 4 · {STEP_TITLES[step]}
        </p>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">{STEP_TITLES[step]}</h1>

      {/* ---------------- Step 0: About you ---------------- */}
      {step === 0 && (
        <div className="mt-5 space-y-5">
          <fieldset>
            <legend className="text-sm font-medium">Biological sex</legend>
            <p className="text-muted-foreground mb-2 text-xs">
              Used only for the BMR formula (Mifflin-St Jeor).
            </p>
            <div className="grid grid-cols-3 gap-2">
              {SEX_OPTIONS.map((o) => (
                <ChoiceCard
                  key={o.value}
                  label={o.label}
                  selected={draft.sex === o.value}
                  onClick={() => set({ sex: o.value })}
                />
              ))}
            </div>
            <FieldError id="sex-error" message={errors.sex} />
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="dob">Date of birth</Label>
            <Input
              id="dob"
              type="date"
              value={draft.dateOfBirth}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => set({ dateOfBirth: e.target.value })}
              aria-invalid={!!errors.dateOfBirth}
            />
            <FieldError id="dob-error" message={errors.dateOfBirth} />
          </div>
        </div>
      )}

      {/* ---------------- Step 1: Your body ---------------- */}
      {step === 1 && (
        <div className="mt-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="height">Height (cm)</Label>
            <Input
              id="height"
              type="number"
              inputMode="numeric"
              min={120}
              max={230}
              placeholder="170"
              value={draft.heightCm}
              onChange={(e) => set({ heightCm: e.target.value })}
              aria-invalid={!!errors.heightCm}
            />
            <FieldError id="height-error" message={errors.heightCm} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="weight">Current weight (kg)</Label>
            <Input
              id="weight"
              type="number"
              inputMode="decimal"
              min={30}
              max={300}
              step="0.1"
              placeholder="70"
              value={draft.weightKg}
              onChange={(e) => set({ weightKg: e.target.value })}
              aria-invalid={!!errors.weightKg}
            />
            <FieldError id="weight-error" message={errors.weightKg} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="target-weight">
              Target weight (kg) <span className="text-muted-foreground font-normal">— optional</span>
            </Label>
            <Input
              id="target-weight"
              type="number"
              inputMode="decimal"
              min={30}
              max={300}
              step="0.1"
              placeholder="65"
              value={draft.targetWeightKg}
              onChange={(e) => set({ targetWeightKg: e.target.value })}
              aria-invalid={!!errors.targetWeightKg}
            />
            <FieldError id="target-weight-error" message={errors.targetWeightKg} />
          </div>
        </div>
      )}

      {/* ---------------- Step 2: Activity ---------------- */}
      {step === 2 && (
        <div className="mt-5 space-y-2">
          <p className="text-muted-foreground text-sm">
            How active are you on a typical week? This scales your maintenance calories.
          </p>
          <div className="grid gap-2">
            {ACTIVITY_OPTIONS.map((o) => (
              <ChoiceCard
                key={o.value}
                label={o.label}
                hint={o.hint}
                selected={draft.activityLevel === o.value}
                onClick={() => set({ activityLevel: o.value })}
              />
            ))}
          </div>
          <FieldError id="activity-error" message={errors.activityLevel} />
        </div>
      )}

      {/* ---------------- Step 3: Goal ---------------- */}
      {step === 3 && (
        <div className="mt-5 space-y-5">
          <fieldset>
            <legend className="text-sm font-medium">Primary goal</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {GOAL_OPTIONS.map((o) => (
                <ChoiceCard
                  key={o.value}
                  label={o.label}
                  hint={o.hint}
                  selected={draft.goalType === o.value}
                  onClick={() => set({ goalType: o.value })}
                />
              ))}
            </div>
            <FieldError id="goal-error" message={errors.goalType} />
          </fieldset>

          {needsRate && (
            <fieldset>
              <legend className="text-sm font-medium">Weekly pace (kg/week)</legend>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {RATE_OPTIONS.map((r) => (
                  <ChoiceCard
                    key={r}
                    label={r}
                    selected={draft.targetRatePerWeek === r}
                    onClick={() => set({ targetRatePerWeek: r })}
                  />
                ))}
              </div>
            </fieldset>
          )}

          <fieldset>
            <legend className="text-sm font-medium">Dietary preference</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {DIET_OPTIONS.map((o) => (
                <ChoiceCard
                  key={o.value || "none"}
                  label={o.label}
                  selected={draft.dietType === o.value}
                  onClick={() => set({ dietType: o.value })}
                />
              ))}
            </div>
          </fieldset>

          {preview && (
            <div className="bg-muted/60 rounded-xl p-4">
              <p className="text-sm font-medium">Your starting targets</p>
              <div className="mt-2 grid grid-cols-4 gap-2 text-center">
                {[
                  { label: "kcal", value: preview.calorieTarget },
                  { label: "Protein", value: `${preview.proteinTargetG}g` },
                  { label: "Carbs", value: `${preview.carbTargetG}g` },
                  { label: "Fat", value: `${preview.fatTargetG}g` },
                ].map((t) => (
                  <div key={t.label} className="rounded-lg bg-background p-2">
                    <p className="text-sm font-semibold">{t.value}</p>
                    <p className="text-muted-foreground text-[11px]">{t.label}</p>
                  </div>
                ))}
              </div>
              <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
                {preview.explanation}
              </p>
            </div>
          )}
        </div>
      )}

      {errors.form && (
        <p role="alert" className="text-destructive mt-4 text-sm">
          {errors.form}
        </p>
      )}

      <Separator className="my-6" />

      {/* ---------------- Navigation ---------------- */}
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || pending}
        >
          Back
        </Button>
        {step < 3 ? (
          <Button type="button" onClick={nextStep}>
            Continue
          </Button>
        ) : (
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? "Setting up…" : "Finish setup"}
          </Button>
        )}
      </div>
    </div>
  );
}
