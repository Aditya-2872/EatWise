import { z } from "zod";

export const SEXES = ["male", "female", "other"] as const;
export const ACTIVITY_LEVELS = [
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
] as const;
export const GOAL_TYPES = [
  "lose_weight",
  "gain_weight",
  "build_muscle",
  "recomposition",
  "maintain",
  "improve_nutrition",
] as const;
export const DIET_TYPES = [
  "omnivore",
  "vegetarian",
  "vegan",
  "eggitarian",
  "halal",
] as const;

/** Onboarding: profile + goal in one step (spec §11). */
export const onboardingSchema = z.object({
  displayName: z.string().trim().min(1).max(60).optional(),
  sex: z.enum(SEXES),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .refine((d) => {
      const age = ageFromDob(d);
      return age != null && age >= 13 && age <= 100;
    }, "Age must be between 13 and 100"),
  heightCm: z.number().min(120).max(230),
  weightKg: z.number().min(30).max(300),
  activityLevel: z.enum(ACTIVITY_LEVELS),
  goalType: z.enum(GOAL_TYPES),
  targetWeightKg: z.number().min(30).max(300).nullish(),
  targetRatePerWeek: z.number().min(0.1).max(1.5).nullish(),
  dietType: z.enum(DIET_TYPES).optional(),
  timeZone: z.string().trim().max(60).optional(),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

export function ageFromDob(dob: string, now = new Date()): number | null {
  const d = new Date(`${dob}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age--;
  return age;
}

export const weightEntrySchema = z.object({
  weightKg: z.number().min(30).max(300),
  recordedAt: z.string().datetime({ offset: true }).optional(),
  notes: z.string().max(280).nullish(),
  source: z.enum(["manual", "import", "onboarding"]).optional(),
});

export const customFoodApiSchema = z.object({
  name: z.string().trim().min(2).max(120),
  brand: z.string().trim().max(120).nullish(),
  servingSize: z.number().positive().max(10000).default(100),
  servingUnit: z.string().trim().min(1).max(10).default("g"),
  calories: z.number().min(0).max(20000),
  proteinG: z.number().min(0).max(2000),
  carbsG: z.number().min(0).max(2000),
  fatG: z.number().min(0).max(2000),
  fiberG: z.number().min(0).max(500).nullish(),
  sugarG: z.number().min(0).max(2000).nullish(),
  sodiumMg: z.number().min(0).max(50000).nullish(),
  category: z.string().trim().max(60).nullish(),
});

export const updateGoalSchema = z.object({
  goalType: z.enum(GOAL_TYPES),
  targetWeightKg: z.number().min(30).max(300).nullish(),
  targetRatePerWeek: z.number().min(0.1).max(1.5).nullish(),
  activityLevel: z.enum(ACTIVITY_LEVELS).optional(),
});
