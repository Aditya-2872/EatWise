"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, Minus, Plus, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { createLogAction } from "@/app/app/actions/logging";
import { enqueueLog } from "@/lib/offline/queue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { computeSnapshot, describeFoodOptions } from "@/lib/nutrition/resolve";
import { parseIntake, type ParsedIntakeItem } from "@/lib/logging/parse-intake";
import type { FoodItemRow, FoodSearchResult } from "@/types/food";
import type { MealType } from "@/types/nutrition";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface QuickItem {
  id: number;
  parsed: ParsedIntakeItem;
  status: "loading" | "matched" | "unmatched";
  matches: FoodSearchResult[];
  selected: FoodItemRow | null;
  qty: number;
  unit: string;
}

let nextId = 1;

const EXAMPLES = [
  "2 roti, 1 katori dal, 1 glass milk",
  "2 eggs and 1 tbsp oil",
  "1 omelette, 2 slice bread",
  "1 bowl rice, 100 g paneer"
];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Pick the starting unit/qty for a parsed item once its food is known. */
function autoUnits(item: ParsedIntakeItem, food: FoodItemRow): { qty: number; unit: string } {
  if (item.unit) {
    const unit = item.unit === "count" ? "count" : item.unit;
    // Count is only legal when the food can be weighed per piece.
    if (unit === "count") {
      const opts = describeFoodOptions(food);
      if (opts.gramsPerCount != null) return { qty: item.qty, unit: "count" };
      return { qty: opts.gramsPerServing ?? 100, unit: "g" };
    }
    return { qty: item.qty, unit };
  }
  const opts = describeFoodOptions(food);
  if (opts.modes.includes("count")) return { qty: item.qty, unit: "count" };
  // No unit given and not countable → assume one reference serving.
  return { qty: opts.gramsPerServing ?? 100, unit: "g" };
}

async function findMatches(name: string): Promise<FoodSearchResult[]> {
  const res = await fetch(`/api/foods/search?q=${encodeURIComponent(name)}&limit=3`);
  if (!res.ok) return [];
  const body = (await res.json()) as { results?: FoodSearchResult[] };
  return body.results ?? [];
}

/* ------------------------------------------------------------------ */
/* Row                                                                 */
/* ------------------------------------------------------------------ */

function ItemRow({
  item,
  onChange,
  onRemove
}: {
  item: QuickItem;
  onChange: (patch: Partial<QuickItem>) => void;
  onRemove: () => void;
}) {
  const preview = useMemo(() => {
    if (!item.selected || item.qty <= 0) return null;
    const computed = computeSnapshot(item.selected, item.qty, item.unit);
    if ("error" in computed) return computed.error;
    return computed;
  }, [item.selected, item.qty, item.unit]);

  const kcal = preview && "snapshot" in preview ? Math.round(preview.snapshot.calories) : null;
  const opts = item.selected ? describeFoodOptions(item.selected) : null;

  return (
    <li className="animate-in fade-in slide-in-from-bottom-2 rounded-xl border p-3 duration-200">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {item.status === "loading" && (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Finding “{item.parsed.name}”…
            </p>
          )}
          {item.status === "unmatched" && (
            <p className="text-sm">
              No match for <span className="font-medium">“{item.parsed.name}”</span>.{" "}
              <span className="text-muted-foreground">
                Try a simpler name (e.g. “egg” instead of “egg omelette”).
              </span>
            </p>
          )}
          {item.selected && (
            <p className="truncate text-sm font-medium">{item.selected.name}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {kcal != null && (
            <span className="text-sm font-semibold tabular-nums">{kcal} kcal</span>
          )}
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${item.parsed.name}`}
            className="text-muted-foreground hover:text-destructive rounded-full p-1 transition-colors">
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      {/* Multiple matches → let the user pick */}
      {item.status === "matched" && item.matches.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.matches.map((m) => (
            <button
              key={`${m.source}:${m.id}`}
              type="button"
              onClick={() => {
                const u = autoUnits(item.parsed, m);
                onChange({ selected: m, qty: u.qty, unit: u.unit });
              }}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                item.selected?.id === m.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-muted"
              )}>
              {m.name}
            </button>
          ))}
        </div>
      )}

      {/* Quantity stepper + unit chips */}
      {item.selected && opts && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="rounded-full"
              onClick={() => onChange({ qty: Math.max(item.unit === "count" ? 1 : 0.25, Math.round((item.qty - (item.unit === "count" ? 1 : item.unit === "g" ? 25 : 0.5)) * 100) / 100) })}
              aria-label="Decrease quantity">
              <Minus aria-hidden />
            </Button>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={item.qty}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n) && n >= 0) onChange({ qty: n });
              }}
              aria-label={`Quantity of ${item.selected.name}`}
              className="h-7 w-16 text-center text-sm tabular-nums"
            />
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="rounded-full"
              onClick={() => onChange({ qty: Math.round((item.qty + (item.unit === "count" ? 1 : item.unit === "g" ? 25 : 0.5)) * 100) / 100 })}
              aria-label="Increase quantity">
              <Plus aria-hidden />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Unit">
            {(opts.modes.includes("count") ? ["count"] : [])
              .concat(opts.modes.includes("volume") ? ["tbsp", "cup", "ml"] : [])
              .concat(["g"])
              .map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => {
                    if (u === item.unit) return;
                    const fallback = u === "count" ? 1 : u === "g" ? (opts.gramsPerServing ?? 100) : 1;
                    onChange({ unit: u, qty: fallback });
                  }}
                  aria-pressed={item.unit === u}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                    item.unit === u
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-muted"
                  )}>
                  {u === "count" ? (opts.countLabel?.replace(/^1\s+/, "") ?? "piece") : u}
                </button>
              ))}
          </div>
          {kcal != null && (
            <span className="text-muted-foreground ml-auto text-xs tabular-nums">
              {preview && "snapshot" in preview
                ? `≈ ${Math.round(preview.resolution.grams)} g${preview.resolution.basis ? ` · ${preview.resolution.basis}` : ""}`
                : ""}
            </span>
          )}
        </div>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Panel                                                               */
/* ------------------------------------------------------------------ */

export interface QuickAddProps {
  date: string;
  dateIsToday: boolean;
  defaultMeal: MealType;
  onChanged: () => void;
}

export function QuickAdd({ date, dateIsToday, defaultMeal, onChanged }: QuickAddProps) {
  const [text, setText] = useState("");
  const [items, setItems] = useState<QuickItem[]>([]);
  const [meal, setMeal] = useState<MealType>(defaultMeal === "custom" ? "snack" : defaultMeal);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function parse(textToParse: string) {
    const parsed = parseIntake(textToParse);
    if (parsed.length === 0) {
      toast.error("Nothing to log yet — type what you ate, e.g. “2 roti, 1 katori dal”.");
      return;
    }
    setDone(false);
    const base: QuickItem[] = parsed.map((p) => ({
      id: nextId++,
      parsed: p,
      status: "loading" as const,
      matches: [],
      selected: null,
      qty: p.qty,
      unit: p.unit ?? "g"
    }));
    setItems((prev) => [...prev, ...base]);
    setText("");

    // Resolve all foods in parallel; each row updates itself as it lands.
    await Promise.all(
      base.map(async (b) => {
        try {
          const matches = await findMatches(b.parsed.name);
          setItems((prev) =>
            prev.map((it) => {
              if (it.id !== b.id) return it;
              if (matches.length === 0) return { ...it, status: "unmatched" };
              const u = autoUnits(b.parsed, matches[0]);
              return { ...it, status: "matched", matches, selected: matches[0], qty: u.qty, unit: u.unit };
            })
          );
        } catch {
          setItems((prev) =>
            prev.map((it) => (it.id === b.id ? { ...it, status: "unmatched" } : it))
          );
        }
      })
    );
  }

  const loggable = items.filter((i) => i.selected != null);
  const totalKcal = loggable.reduce((sum, i) => {
    if (!i.selected) return sum;
    const c = computeSnapshot(i.selected, i.qty, i.unit);
    return sum + ("snapshot" in c ? c.snapshot.calories : 0);
  }, 0);
  const stillLoading = items.some((i) => i.status === "loading");

  async function saveAll() {
    if (loggable.length === 0 || saving) return;
    setSaving(true);
    let logged = 0;
    let queued = 0;
    let failed = 0;
    for (const item of loggable) {
      const payload = {
        foodId: item.selected!.id,
        quantity: item.qty,
        unit: item.unit,
        mealType: meal,
        source: "manual" as const,
        ...(dateIsToday ? {} : { loggedAt: new Date(`${date}T12:00:00Z`).toISOString() })
      };
      try {
        const res = await createLogAction(payload);
        if (res.ok) logged += 1;
        else failed += 1;
      } catch {
        await enqueueLog(payload);
        queued += 1;
      }
    }
    setSaving(false);

    if (failed > 0) toast.error(`${failed} item${failed > 1 ? "s" : ""} could not be saved.`);
    if (queued > 0) toast.info(`${queued} item${queued > 1 ? "s" : ""} queued — will sync when you're back online.`);
    if (logged > 0) toast.success(`Logged ${logged} item${logged > 1 ? "s" : ""} · ${Math.round(totalKcal)} kcal`);
    if (logged + queued > 0) {
      setItems([]);
      setDone(true);
      onChanged();
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void parse(text);
              }
            }}
            placeholder="What did you eat? e.g. 2 roti, 1 katori dal, 1 glass milk"
            aria-label="Describe what you ate"
            className="h-11 flex-1 text-base"
            autoComplete="off"
          />
          <Button size="lg" className="h-11" onClick={() => void parse(text)} disabled={text.trim().length === 0}>
            <Sparkles aria-hidden />
            Add
          </Button>
        </div>
        <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
          <Sparkles className="size-3.5" aria-hidden />
          Type it the way you'd say it — counts, katoris, spoons. No grams needed.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => void parse(ex)}
              className="border-border hover:bg-muted rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors">
              {ex}
            </button>
          ))}
        </div>
      </div>

      {done && items.length === 0 && (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <CheckCircle2 className="size-4" aria-hidden /> Saved. Anything else?
        </p>
      )}

      {items.length > 0 && (
        <>
          <ul className="space-y-2">
            {items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                onChange={(patch) =>
                  setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, ...patch } : it)))
                }
                onRemove={() => setItems((prev) => prev.filter((it) => it.id !== item.id))}
              />
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Meal type">
              {(["breakfast", "lunch", "dinner", "snack"] as MealType[]).map((m) => (
                <Button
                  key={m}
                  type="button"
                  size="sm"
                  variant={meal === m ? "default" : "outline"}
                  aria-pressed={meal === m}
                  onClick={() => setMeal(m)}>
                  {m[0].toUpperCase() + m.slice(1)}
                </Button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-3">
              {loggable.length > 0 && (
                <span className="text-sm font-semibold tabular-nums">
                  {Math.round(totalKcal)} kcal
                </span>
              )}
              <Button size="lg" onClick={saveAll} disabled={saving || stillLoading || loggable.length === 0}>
                {saving
                  ? "Saving…"
                  : `Log ${loggable.length} item${loggable.length === 1 ? "" : "s"}`}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
