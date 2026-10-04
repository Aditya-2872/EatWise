"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteLogAction, editLogAction } from "@/app/app/actions/logging";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DaySummary, FoodLogRow } from "@/lib/logging/service";
import type { MealType } from "@/types/nutrition";

const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack", "custom"];
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
  custom: "Other"
};

function fmtQty(q: number): string {
  return Number.isInteger(q) ? String(q) : q.toFixed(1).replace(/\.0$/, "");
}

/* ------------------------------------------------------------------ */
/* Edit dialog                                                         */
/* ------------------------------------------------------------------ */

function EditLogDialog({
  log,
  open,
  onOpenChange,
  onSaved
}: {
  log: FoodLogRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("");
  const [meal, setMeal] = useState<MealType>("breakfast");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initializedFor, setInitializedFor] = useState<string | null>(null);

  if (log && open && initializedFor !== log.id) {
    setInitializedFor(log.id);
    setQty(String(log.quantity));
    setUnit(log.unit);
    setMeal(log.meal_type);
    setError(null);
  }

  if (!log) return null;

  async function save() {
    if (!log) return;
    setSaving(true);
    setError(null);
    const quantity = Number(qty);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Enter a quantity greater than 0.");
      setSaving(false);
      return;
    }
    const res = await editLogAction(log.id, {
      quantity,
      unit: unit.trim() || log.unit,
      mealType: meal
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.success("Entry updated");
    onOpenChange(false);
    setInitializedFor(null);
    onSaved();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setInitializedFor(null);
      }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit entry</DialogTitle>
          <DialogDescription>{log.food_name ?? "Logged item"}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="w-28 space-y-2">
              <Label htmlFor="edit-qty">Quantity</Label>
              <Input
                id="edit-qty"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
            <div className="w-24 space-y-2">
              <Label htmlFor="edit-unit">Unit</Label>
              <Input
                id="edit-unit"
                maxLength={20}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Meal</Label>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Meal type">
              {MEAL_ORDER.filter((m) => m !== "custom").map((m) => (
                <Button
                  key={m}
                  type="button"
                  size="sm"
                  variant={meal === m ? "default" : "outline"}
                  aria-pressed={meal === m}
                  onClick={() => setMeal(m)}>
                  {MEAL_LABELS[m]}
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
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Row                                                                 */
/* ------------------------------------------------------------------ */

function LogRowWithActions({
  log,
  onEdit,
  onChanged
}: {
  log: FoodLogRow;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const snap = log.nutrition_snapshot;

  async function remove() {
    setBusy(true);
    const res = await deleteLogAction(log.id);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      setConfirming(false);
      return;
    }
    toast.success("Entry deleted");
    setConfirming(false);
    onChanged();
  }

  return (
    <li className="flex items-center justify-between gap-2 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {log.food_name?.trim() || "Logged item"}
          {log.food_brand ? (
            <span className="text-muted-foreground font-normal"> · {log.food_brand}</span>
          ) : null}
        </p>
        <p className="text-muted-foreground text-xs tabular-nums">
          {fmtQty(log.quantity)} {log.unit} · {Math.round(snap.calories)} kcal · P{" "}
          {Math.round(snap.proteinG)}g · C {Math.round(snap.carbsG)}g · F {Math.round(snap.fatG)}g
        </p>
      </div>
      {confirming ? (
        <div className="flex shrink-0 items-center gap-1">
          <Button size="sm" variant="destructive" onClick={remove} disabled={busy}>
            {busy ? "…" : "Delete"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
            Keep
          </Button>
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={onEdit}
            aria-label={`Edit ${log.food_name ?? "entry"}`}>
            <Pencil aria-hidden />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setConfirming(true)}
            aria-label={`Delete ${log.food_name ?? "entry"}`}>
            <Trash2 aria-hidden />
          </Button>
        </div>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Day list                                                            */
/* ------------------------------------------------------------------ */

export function DayLogs({
  summary,
  onChanged
}: {
  summary: DaySummary;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<FoodLogRow | null>(null);
  const { intake } = summary;

  const groups = MEAL_ORDER.map((meal) => ({
    meal,
    logs: intake.logs.filter((l) => l.meal_type === meal),
    total: intake.byMeal[meal]
  })).filter((g) => g.logs.length > 0);

  if (intake.logs.length === 0) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
        Nothing logged for this day yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.meal} className="rounded-xl border">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <h3 className="text-sm font-semibold">{MEAL_LABELS[g.meal]}</h3>
            <span className="text-muted-foreground text-xs tabular-nums">
              {Math.round(g.total?.calories ?? 0)} kcal
            </span>
          </div>
          <ul className="divide-y px-3">
            {g.logs.map((log) => (
              <LogRowWithActions
                key={log.id}
                log={log}
                onEdit={() => setEditing(log)}
                onChanged={onChanged}
              />
            ))}
          </ul>
        </div>
      ))}

      <EditLogDialog
        log={editing}
        open={editing != null}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
        onSaved={onChanged}
      />
    </div>
  );
}
