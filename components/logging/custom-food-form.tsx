"use client";

import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { createCustomFoodAction } from "@/app/app/actions/logging";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { customFoodApiSchema } from "@/lib/validation/goals";
import type { FoodItemRow } from "@/types/food";

const optionalNum = z.coerce.number().min(0).optional().or(z.literal(""));

const formSchema = customFoodApiSchema.extend({
  fiberG: optionalNum,
  sugarG: optionalNum,
  sodiumMg: optionalNum
});

interface CustomFoodFormProps {
  onCreated: (food: FoodItemRow) => void;
}

/** Manual entry: build a private food, then log it (spec §13.5). */
export function CustomFoodForm({ onCreated }: CustomFoodFormProps) {
  const [form, setForm] = useState({
    name: "",
    brand: "",
    servingSize: "100",
    servingUnit: "g",
    calories: "",
    proteinG: "",
    carbsG: "",
    fatG: "",
    fiberG: "",
    sugarG: "",
    sodiumMg: ""
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const numOr = (s: string, fallback: number) => (s.trim() === "" ? fallback : Number(s));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = formSchema.safeParse({
      ...form,
      servingSize: Number(form.servingSize || 100),
      calories: Number(form.calories),
      proteinG: Number(form.proteinG),
      carbsG: Number(form.carbsG),
      fatG: Number(form.fatG),
      fiberG: form.fiberG.trim() === "" ? undefined : Number(form.fiberG),
      sugarG: form.sugarG.trim() === "" ? undefined : Number(form.sugarG),
      sodiumMg: form.sodiumMg.trim() === "" ? undefined : Number(form.sodiumMg)
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the details.");
      return;
    }
    if (!Number.isFinite(parsed.data.calories) || Number.isNaN(parsed.data.calories)) {
      setError("Calories must be a number.");
      return;
    }

    setSaving(true);
    const res = await createCustomFoodAction({
      ...parsed.data,
      fiberG: parsed.data.fiberG === "" ? undefined : parsed.data.fiberG,
      sugarG: parsed.data.sugarG === "" ? undefined : parsed.data.sugarG,
      sodiumMg: parsed.data.sodiumMg === "" ? undefined : parsed.data.sodiumMg
    });
    if (!res.ok) {
      setError(res.error);
      setSaving(false);
      return;
    }

    // Fetch the created row so the log dialog gets full data.
    try {
      const full = await fetch(`/api/foods/${res.foodId}`);
      if (full.ok) {
        const body = (await full.json()) as { food: FoodItemRow };
        toast.success(`“${body.food.name}” saved to your foods`);
        setForm((f) => ({ ...f, name: "", brand: "", calories: "", proteinG: "", carbsG: "", fatG: "" }));
        setSaving(false);
        onCreated(body.food);
        return;
      }
    } catch {
      /* fall through */
    }
    toast.success("Food saved — search for it to log a portion.");
    setSaving(false);
  }

  const macroField = (
    key: "calories" | "proteinG" | "carbsG" | "fatG" | "fiberG" | "sugarG" | "sodiumMg",
    label: string,
    required: boolean
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={`cf-${key}`}>
        {label}
        {required ? "" : " (optional)"}
      </Label>
      <Input
        id={`cf-${key}`}
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        required={required}
        value={form[key]}
        onChange={(e) => set({ [key]: e.target.value })}
      />
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="cf-name">Name *</Label>
          <Input
            id="cf-name"
            required
            placeholder="Homemade masala oats"
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cf-brand">Brand / source</Label>
          <Input
            id="cf-brand"
            placeholder="Home recipe"
            value={form.brand}
            onChange={(e) => set({ brand: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="cf-serving">Serving size *</Label>
          <div className="flex gap-2">
            <Input
              id="cf-serving"
              type="number"
              inputMode="decimal"
              min={0.1}
              step="any"
              className="flex-1"
              value={form.servingSize}
              onChange={(e) => set({ servingSize: e.target.value })}
            />
            <Input
              aria-label="Serving unit"
              className="w-20"
              maxLength={10}
              value={form.servingUnit}
              onChange={(e) => set({ servingUnit: e.target.value })}
            />
          </div>
          <p className="text-muted-foreground text-xs">Nutrition below is per this serving.</p>
        </div>
        {macroField("calories", "Calories (kcal) *", true)}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {macroField("proteinG", "Protein (g) *", true)}
        {macroField("carbsG", "Carbs (g) *", true)}
        {macroField("fatG", "Fat (g) *", true)}
      </div>

      <details className="text-muted-foreground text-sm">
        <summary className="cursor-pointer select-none">Optional details</summary>
        <div className="mt-3 grid grid-cols-3 gap-4">
          {macroField("fiberG", "Fiber (g)", false)}
          {macroField("sugarG", "Sugar (g)", false)}
          {macroField("sodiumMg", "Sodium (mg)", false)}
        </div>
      </details>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save & log this food"}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Custom foods are private to you and appear in your search results.
      </p>
    </form>
  );
}
