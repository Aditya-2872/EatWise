"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getUserContext } from "@/lib/auth/session";
import { completeOnboarding, updateGoal } from "@/lib/goals/service";
import { addWeightEntry } from "@/lib/progress/service";
import { onboardingSchema, updateGoalSchema } from "@/lib/validation/goals";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check the details.";
}

export async function completeOnboardingAction(input: unknown): Promise<ActionResult<null>> {
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, error: "You must be signed in." };

  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const result = await completeOnboarding(ctx.supabase, ctx.userId, {
    ...parsed.data,
    timeZone: parsed.data.timeZone ?? ctx.timeZone,
  });
  if (!result.ok) return { ok: false, error: result.error ?? "Could not complete onboarding." };

  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

export async function updateGoalAction(input: unknown): Promise<ActionResult<null>> {
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, error: "You must be signed in." };

  const parsed = updateGoalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const result = await updateGoal(ctx.supabase, ctx.userId, parsed.data);
  if (!result.ok) return { ok: false, error: result.error ?? "Could not update your goal." };

  revalidatePath("/app/dashboard");
  revalidatePath("/app/goals");
  return { ok: true, data: null };
}

const weightSchema = z.object({
  weightKg: z.number().min(20).max(400),
  /** yyyy-mm-dd; defaults to today on the server. */
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().trim().max(280).nullish(),
});

const profileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(60).optional(),
    timeZone: z
      .string()
      .trim()
      .max(60)
      .refine((tz) => {
        try {
          new Intl.DateTimeFormat("en-US", { timeZone: tz });
          return true;
        } catch {
          return false;
        }
      }, "Unknown timezone")
      .optional(),
    heightCm: z.number().min(120).max(230).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

export async function updateProfileAction(input: unknown): Promise<ActionResult<null>> {
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, error: "You must be signed in." };

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const update: Record<string, unknown> = {};
  if (parsed.data.displayName !== undefined) update.display_name = parsed.data.displayName;
  if (parsed.data.timeZone !== undefined) update.timezone = parsed.data.timeZone;
  if (parsed.data.heightCm !== undefined) update.height_cm = parsed.data.heightCm;

  const { error } = await ctx.supabase
    .from("profiles")
    .update(update)
    .eq("id", ctx.userId);
  if (error) {
    console.error("[actions] profile update failed:", error.message);
    return { ok: false, error: "Could not save your profile." };
  }

  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

export async function addWeightAction(input: unknown): Promise<ActionResult<null>> {
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, error: "You must be signed in." };

  const parsed = weightSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const entry = await addWeightEntry(ctx.supabase, ctx.userId, {
    weightKg: parsed.data.weightKg,
    ...(parsed.data.entryDate
      ? { recordedAt: new Date(`${parsed.data.entryDate}T12:00:00Z`).toISOString() }
      : {}),
    ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
    source: "manual",
  });
  if (!entry) return { ok: false, error: "Could not save the weight entry." };

  revalidatePath("/app/progress");
  revalidatePath("/app/dashboard");
  return { ok: true, data: null };
}
