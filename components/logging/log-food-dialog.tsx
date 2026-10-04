"use client";

import { useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import { createLogAction } from "@/app/app/actions/logging";
import { enqueueLog } from "@/lib/offline/queue";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { normalizeUnit, unitKind } from "@/lib/nutrition/units";
import {
  computeSnapshot,
  describeFoodOptions,
  type QuantityMode
} from "@/lib/nutrition/resolve";
import type { FoodItemRow } from "@/types/food";
import type { LogSource, MealType } from "@/types/nutrition";

const MEAL_CHOICES: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" }
];

const MODE_LABEL: Record<QuantityMode, string> = {
  count: "Count",
  volume: "Spoon / Cup",
  weight: "Grams"
};

const VOLUME_UNITS = ["tsp", "tbsp", "cup", "ml"] as const;
const WEIGHT_UNITS = ["g", "kg"] as const;

/** Step size for the −/+ stepper, per unit. */
function stepFor(unit: string): number {
  switch (unit) {
    case "count":
      return 1;
    case "kg":
      return 0.1;
    case "cup":
      return 0.25;
    case "tsp":
    case "tbsp":
      return 0.5;
    case "ml":
      return 25;
    default:
      return 10; // g
  }
}

function fmtQty(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

export interface LogFoodDialogProps {
  food: FoodItemRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** yyyy-mm-dd local date the log belongs to. */
  date: string;
  /** True when `date` is the user's today (omit loggedAt → server "now"). */
  dateIsToday: boolean;
  defaultMeal: MealType;
  source: LogSource;
  onLogged: () => void;
}

export function LogFoodDialog({
  food,
  open,
  onOpenChange,
  date,
  dateIsToday,
  defaultMeal,
  source,
  onLogged
}: LogFoodDialogProps) {
  const options = useMemo(() => (food ? describeFoodOptions(food) : null), [food]);

  const [mode, setMode] = useState<QuantityMode>("weight");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("g");
  const [meal, setMeal] = useState<MealType>(defaultMeal);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset fields whenever a different food is opened, starting from the most
  // natural way to measure THAT food (2 rotis, 1 glass milk, 100 g paneer…).
  useEffect(() => {
    if (!open || !food || !options) return;
    setError(null);
    setMeal(defaultMeal);
    setMode(options.defaultMode);
    const servingUnit = normalizeUnit(food.serving_unit ?? "g");
    if (options.defaultMode === "count") {
      setQty("1");
      setUnit("count");
    } else if (options.defaultMode === "volume") {
      if (unitKind(servingUnit) === "volume") {
        setQty(fmtQty(food.serving_size || 1));
        setUnit(servingUnit);
      } else {
        setQty("1");
        setUnit("tbsp");
      }
    } else {
      setQty(fmtQty(unitKind(servingUnit) === "mass" ? food.serving_size || 100 : 100));
      setUnit(servingUnit === "kg" ? "kg" : "g");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, food?.id]);

  function switchMode(next: QuantityMode) {
    if (!food || !options) return;
    setMode(next);
    const servingUnit = normalizeUnit(food.serving_unit ?? "g");
    if (next === "count") {
      setQty("1");
      setUnit("count");
    } else if (next === "volume") {
      if (unitKind(servingUnit) === "volume") {
        setQty(fmtQty(food.serving_size || 1));
        setUnit(servingUnit === "l" ? "ml" : servingUnit);
      } else {
        setQty("1");
        setUnit("tbsp");
      }
    } else {
      setQty(fmtQty(unitKind(servingUnit) === "mass" ? food.serving_size || 100 : 100));
      setUnit(servingUnit === "kg" ? "kg" : "g");
    }
  }

  // Exact live preview — the SAME deterministic math the server runs on save.
  const preview = useMemo(() => {
    if (!food) return null;
    const q = Number(qty);
    if (!Number.isFinite(q) || q <= 0) return null;
    const computed = computeSnapshot(food, q, unit);
    if ("error" in computed) return computed.error;
    return computed;
  }, [food, qty, unit]);

  if (!food || !options) return null;

  function bump(delta: number) {
    const current = Number(qty) || 0;
    const next = Math.max(stepFor(unit), Math.round((current + delta * stepFor(unit)) * 100) / 100);
    setQty(fmtQty(next));
  }

  async function submit() {
    if (!food) return;
    setSaving(true);
    setError(null);
    const quantity = Number(qty);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Enter a quantity greater than 0.");
      setSaving(false);
      return;
    }

    const payload = {
      foodId: food.id,
      quantity,
      unit,
      mealType: meal,
      source,
      ...(dateIsToday ? {} : { loggedAt: new Date(`${date}T12:00:00Z`).toISOString() })
    };

    let res: Awaited<ReturnType<typeof createLogAction>>;
    try {
      res = await createLogAction(payload);
    } catch {
      // Network failure — queue in IndexedDB and replay when back online (spec §23/§29).
      setSaving(false);
      await enqueueLog(payload);
      toast.info("You're offline. Your log will be saved and synced when you're back online.");
      onOpenChange(false);
      onLogged();
      return;
    }
    setSaving(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.success(`${food.name} logged · ${Math.round(res.log.nutrition_snapshot.calories)} kcal`);
    onOpenChange(false);
    onLogged();
  }

  const kcal = preview && "snapshot" in preview ? Math.round(preview.snapshot.calories) : null;
  const grams = preview && "snapshot" in preview ? Math.round(preview.resolution.grams) : null;
  const basis = preview && "snapshot" in preview ? preview.resolution.basis : null;
  const unitChoices =
    mode === "volume" ? [...VOLUME_UNITS] : mode === "weight" ? [...WEIGHT_UNITS] : [];

  // Quick-pick chips per mode — one tap for the most common amounts.
  const chips: { label: string; qty: string; unit: string }[] =
    mode === "count"
      ? [1, 2, 3, 4].map((n) => ({ label: String(n), qty: String(n), unit: "count" }))
      : mode === "volume"
        ? [
            { label: "1 tsp", qty: "1", unit: "tsp" },
            { label: "1 tbsp", qty: "1", unit: "tbsp" },
            { label: "¼ cup", qty: "0.25", unit: "cup" },
            { label: "½ cup", qty: "0.5", unit: "cup" },
            { label: "1 cup", qty: "1", unit: "cup" }
          ]
        : [
            { label: "50 g", qty: "50", unit: "g" },
            { label: "100 g", qty: "100", unit: "g" },
            { label: "150 g", qty: "150", unit: "g" },
            ...(options.gramsPerServing
              ? [
                  {
                    label: `1 serving (${Math.round(options.gramsPerServing)} g)`,
                    qty: fmtQty(
                      normalizeUnit(food.serving_unit) === "kg"
                        ? options.gramsPerServing / 1000
                        : food.serving_size
                    ),
                    unit: normalizeUnit(food.serving_unit) === "kg" ? "kg" : "g"
                  }
                ]
              : [])
          ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log {food.name}</DialogTitle>
          <DialogDescription>
            {food.brand ? `${food.brand} · ` : ""}
            {food.serving_size} {food.serving_unit} = {Math.round(food.calories)} kcal
            {options.countLabel ? ` · ${options.countLabel}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* How are you measuring this? Only resolvable modes are offered. */}
          <div className="bg-muted/60 grid grid-flow-col rounded-xl p-1" role="group" aria-label="Measure by">
            {options.modes.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                aria-pressed={mode === m}
                className={cn(
                  "rounded-lg px-2 py-1.5 text-sm font-medium transition-all",
                  mode === m
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}>
                {m === "count" && options.countLabel ? "Count" : MODE_LABEL[m]}
              </button>
            ))}
          </div>

          {mode === "count" && options.countLabel ? (
            <p className="text-muted-foreground -mt-2 text-xs" aria-live="polite">
              1 × {options.countLabel}
              {options.gramsPerCount ? ` ≈ ${Math.round(options.gramsPerCount)} g` : ""}
            </p>
          ) : null}

          {/* Big stepper: − [ qty ] + with unit toggles */}
          <div className="flex items-center justify-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              className="size-12 rounded-full text-lg"
              onClick={() => bump(-1)}
              aria-label="Decrease quantity">
              <Minus aria-hidden />
            </Button>
            <div className="flex items-baseline gap-2">
              <Input
                id="log-qty"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                aria-label="Quantity"
                className="h-12 w-24 text-center text-xl font-semibold tabular-nums"
              />
              <span className="text-muted-foreground min-w-10 text-sm font-medium">
                {mode === "count" ? (options.gramsPerCount && Number(qty) > 1 ? "×" : "") + (options.countLabel?.replace(/^1\s+/, "") ?? "item") : unit}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              className="size-12 rounded-full text-lg"
              onClick={() => bump(1)}
              aria-label="Increase quantity">
              <Plus aria-hidden />
            </Button>
          </div>

          {unitChoices.length > 1 && (
            <div className="flex justify-center gap-1.5" role="group" aria-label="Unit">
              {unitChoices.map((u) => (
                <Button
                  key={u}
                  type="button"
                  size="sm"
                  variant={unit === u ? "default" : "outline"}
                  className="min-w-12"
                  aria-pressed={unit === u}
                  onClick={() => setUnit(u)}>
                  {u}
                </Button>
              ))}
            </div>
          )}

          {/* One-tap common amounts */}
          <div className="flex flex-wrap justify-center gap-1.5" role="group" aria-label="Quick amounts">
            {chips.map((c) => (
              <button
                key={`${c.label}-${c.unit}`}
                type="button"
                onClick={() => {
                  setQty(c.qty);
                  setUnit(c.unit);
                }}
                aria-pressed={qty === c.qty && unit === c.unit}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  qty === c.qty && unit === c.unit
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-muted"
                )}>
                {c.label}
              </button>
            ))}
          </div>

          {/* Live nutrition preview — exact server math, no guessing */}
          <div
            className="bg-muted/40 rounded-xl px-4 py-3 text-center"
            aria-live="polite">
            {kcal != null ? (
              <>
                <p className="text-2xl font-semibold tracking-tight tabular-nums">
                  <span key={kcal} className="inline-block animate-in fade-in slide-in-from-bottom-1 duration-200">
                    {kcal}
                  </span>{" "}
                  <span className="text-muted-foreground text-base font-normal">kcal</span>
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
                  {preview && "snapshot" in preview
                    ? `P ${Math.round(preview.snapshot.proteinG)}g · C ${Math.round(
                        preview.snapshot.carbsG
                      )}g · F ${Math.round(preview.snapshot.fatG)}g · ${grams} g`
                    : ""}
                  {basis ? ` · ${basis}` : ""}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">Enter a quantity to see calories.</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Meal type">
              {MEAL_CHOICES.map((m) => (
                <Button
                  key={m.value}
                  type="button"
                  size="sm"
                  variant={meal === m.value ? "default" : "outline"}
                  aria-pressed={meal === m.value}
                  onClick={() => setMeal(m.value)}>
                  {m.label}
                </Button>
              ))}
            </div>
          </div>

          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving || kcal == null} size="lg">
              {saving ? "Saving…" : kcal != null ? `Add · ${kcal} kcal` : "Add to log"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
