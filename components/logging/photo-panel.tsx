"use client";

/**
 * AI photo logging (spec §14): capture/upload → compress on-device →
 * /api/ai/analyze-food-image → review items with confidence + basis badges →
 * optional clarification round → edit portions/meal → /api/ai/confirm-items.
 * Nutrition shown here is a linear preview; the server recomputes the
 * authoritative frozen snapshot at confirm time.
 */
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, HelpCircle, Loader2, RotateCcw, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { AnalyzeFoodImageResponse, ConfirmItemsResponse, MappedAiItem } from "@/types/ai";
import type { MealType } from "@/types/nutrition";

const MEAL_CHOICES: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" }
];

const MAX_SIDE = 1280;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that image file."));
    img.src = src;
  });
}

/** Downscale to ≤1280px and re-encode as JPEG (keeps uploads small & private). */
async function compressImage(file: File): Promise<{ dataUrl: string; base64: string }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) throw new Error("Image processing is unavailable in this browser.");
    ctx2d.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    return { dataUrl, base64: dataUrl.slice(dataUrl.indexOf(",") + 1) };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function apiError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

function confidenceTone(value: number): string {
  const pct = Math.round(value * 100);
  if (pct >= 80) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
  if (pct >= 55) return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
  return "bg-destructive/10 text-destructive";
}

function isLoggable(item: MappedAiItem): boolean {
  return item.snapshot != null && (item.foodId != null || item.nutritionPer100g != null);
}

interface ItemEdit {
  qty: string;
  meal: MealType;
  include: boolean;
}

function initialEdits(items: MappedAiItem[], defaultMeal: MealType): ItemEdit[] {
  return items.map((it) => ({
    qty: String(Math.round(it.quantity * 10) / 10),
    meal: defaultMeal,
    include: isLoggable(it)
  }));
}

/** Linear client-side preview — the server's frozen snapshot is authoritative. */
function previewNutrition(item: MappedAiItem, qty: number) {
  if (!item.snapshot || item.quantity <= 0 || !Number.isFinite(qty) || qty <= 0) return null;
  const f = qty / item.quantity;
  return {
    calories: Math.round(item.snapshot.calories * f),
    proteinG: Math.round(item.snapshot.proteinG * f),
    carbsG: Math.round(item.snapshot.carbsG * f),
    fatG: Math.round(item.snapshot.fatG * f)
  };
}

export interface PhotoPanelProps {
  defaultMeal: MealType;
  /** Called after at least one item was logged (invalidate day + recents). */
  onChanged: () => void;
}

export function PhotoPanel({ defaultMeal, onChanged }: PhotoPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<"idle" | "analyzing" | "results" | "clarifying" | "confirming">("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [hints, setHints] = useState("");
  const [resp, setResp] = useState<AnalyzeFoodImageResponse | null>(null);
  const [edits, setEdits] = useState<ItemEdit[]>([]);
  const [clarifyAnswer, setClarifyAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setPhase("idle");
    setPreviewUrl(null);
    setImageBase64(null);
    setHints("");
    setResp(null);
    setEdits([]);
    setClarifyAnswer("");
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const { dataUrl, base64 } = await compressImage(file);
      setPreviewUrl(dataUrl);
      setImageBase64(base64);
      setResp(null);
      setEdits([]);
      setPhase("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process that image.");
    }
  }

  async function analyze() {
    if (!imageBase64) return;
    setPhase("analyzing");
    setError(null);
    try {
      const res = await fetch("/api/ai/analyze-food-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          mimeType: "image/jpeg",
          ...(defaultMeal !== "custom" ? { mealType: defaultMeal } : {}),
          ...(hints.trim() ? { hints: hints.trim() } : {})
        })
      });
      if (!res.ok) {
        setError(await apiError(res, "Photo analysis failed."));
        setPhase("idle");
        return;
      }
      const data = (await res.json()) as AnalyzeFoodImageResponse;
      setResp(data);
      setEdits(initialEdits(data.items, defaultMeal));
      setPhase("results");
    } catch {
      setError("Network error while analyzing the photo. Please try again.");
      setPhase("idle");
    }
  }

  async function sendClarification() {
    if (!resp?.clarification || !clarifyAnswer.trim()) return;
    setPhase("clarifying");
    setError(null);
    try {
      const res = await fetch("/api/ai/clarify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisId: resp.analysisId,
          analysis: resp.rawAnalysis,
          question: resp.clarification.question,
          answer: clarifyAnswer.trim()
        })
      });
      if (!res.ok) {
        setError(await apiError(res, "Clarification failed."));
        setPhase("results");
        return;
      }
      const data = (await res.json()) as AnalyzeFoodImageResponse;
      setResp(data);
      setEdits(initialEdits(data.items, defaultMeal));
      setClarifyAnswer("");
      setPhase("results");
    } catch {
      setError("Network error during clarification.");
      setPhase("results");
    }
  }

  async function confirm() {
    if (!resp) return;
    const included = resp.items
      .map((item, index) => ({ item, index, edit: edits[index] }))
      .filter((e) => e.edit?.include && isLoggable(e.item));
    if (included.length === 0) {
      setError("Select at least one item to log.");
      return;
    }
    const payloadItems = [];
    for (const { item, edit } of included) {
      const qty = Number(edit.qty);
      if (!Number.isFinite(qty) || qty <= 0) {
        setError(`"${item.candidate}" needs a quantity greater than 0.`);
        return;
      }
      payloadItems.push({
        candidate: item.candidate,
        quantity: qty,
        unit: item.unit,
        mealType: edit.meal,
        confidence: item.confidence,
        foodId: item.foodId,
        nutritionPer100g: item.nutritionPer100g,
        uncertaintyFactors: item.uncertaintyFactors,
        ...(qty !== item.quantity ? { originalQuantity: item.quantity } : {})
      });
    }

    setPhase("confirming");
    setError(null);
    try {
      const res = await fetch("/api/ai/confirm-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisId: resp.analysisId, items: payloadItems })
      });
      if (!res.ok) {
        setError(await apiError(res, "Could not save the items."));
        setPhase("results");
        return;
      }
      const data = (await res.json()) as ConfirmItemsResponse;
      const failed = data.results.filter((r) => !r.ok);
      if (data.loggedCount > 0) {
        toast.success(
          failed.length > 0
            ? `Logged ${data.loggedCount} item${data.loggedCount === 1 ? "" : "s"} — ${failed.length} failed.`
            : `Logged ${data.loggedCount} item${data.loggedCount === 1 ? "" : "s"} from your photo.`
        );
        onChanged();
        reset();
      } else {
        setError(failed[0]?.error ?? "Nothing was logged.");
        setPhase("results");
      }
    } catch {
      setError("Network error while saving. Please try again.");
      setPhase("results");
    }
  }

  const busy = phase === "analyzing" || phase === "clarifying" || phase === "confirming";

  return (
    <div className="space-y-4">
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="sr-only"
        aria-label="Take or choose a photo of your food"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />

      {/* Step 1 — capture */}
      {phase !== "results" && (
        <div className="flex flex-col items-start gap-4 sm:flex-row">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Food to analyze"
              className="h-44 w-full rounded-lg border object-cover sm:w-64"
            />
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-muted-foreground hover:border-primary/50 hover:text-foreground flex h-44 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm transition-colors sm:w-64">
              <Camera className="size-7" aria-hidden />
              Take or upload a photo
            </button>
          )}

          <div className="min-w-0 flex-1 space-y-3">
            {previewUrl && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
                  <RotateCcw aria-hidden /> Retake
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={reset}
                  disabled={busy}
                  aria-label="Remove photo">
                  Clear
                </Button>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="photo-hints">Anything we should know? (optional)</Label>
              <Input
                id="photo-hints"
                value={hints}
                maxLength={300}
                placeholder='e.g. "two rotis, dal and a glass of buttermilk"'
                onChange={(e) => setHints(e.target.value)}
                disabled={busy}
              />
            </div>
            <Button onClick={() => void analyze()} disabled={!imageBase64 || busy}>
              {phase === "analyzing" ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden /> Analyzing…
                </>
              ) : (
                <>
                  <Sparkles aria-hidden /> Analyze photo
                </>
              )}
            </Button>
            <p className="text-muted-foreground text-xs">
              Photos are analyzed on-device-compressed and never stored. Nutrition always comes
              from the verified database or an estimate you confirm — never invented silently.
            </p>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      {/* Step 2 — results review */}
      {resp && (phase === "results" || phase === "clarifying" || phase === "confirming") && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="" className="size-12 rounded-md border object-cover" />
            )}
            <h3 className="text-sm font-semibold">
              {resp.items.length} item{resp.items.length === 1 ? "" : "s"} identified
            </h3>
            <Badge className={confidenceTone(resp.overallConfidence)}>
              {Math.round(resp.overallConfidence * 100)}% confidence
            </Badge>
            <Button size="sm" variant="ghost" className="ml-auto" onClick={reset} disabled={busy}>
              <RotateCcw aria-hidden /> Start over
            </Button>
          </div>

          {/* Smart clarification (spec §14) */}
          {resp.needsClarification && resp.clarification && (
            <div className="bg-muted/50 space-y-2 rounded-lg border p-3">
              <p className="flex items-start gap-2 text-sm font-medium">
                <HelpCircle className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
                {resp.clarification.question}
              </p>
              <Textarea
                value={clarifyAnswer}
                onChange={(e) => setClarifyAnswer(e.target.value)}
                maxLength={300}
                rows={2}
                placeholder="Type your answer…"
                aria-label="Your answer"
                disabled={busy}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => void sendClarification()}
                disabled={busy || !clarifyAnswer.trim()}>
                {phase === "clarifying" ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden /> Refining…
                  </>
                ) : (
                  "Send answer"
                )}
              </Button>
            </div>
          )}

          {/* Items */}
          <ul className="space-y-3">
            {resp.items.map((item, index) => {
              const edit = edits[index];
              if (!edit) return null;
              const qty = Number(edit.qty);
              const preview = previewNutrition(item, qty);
              const loggable = isLoggable(item);
              return (
                <li
                  key={`${item.candidate}-${index}`}
                  className={cn(
                    "rounded-lg border p-3 transition-opacity",
                    !edit.include && "opacity-55",
                    !loggable && "border-destructive/40"
                  )}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{item.foodName ?? item.candidate}</span>
                    {item.foodBrand && (
                      <span className="text-muted-foreground text-xs">{item.foodBrand}</span>
                    )}
                    <Badge className={confidenceTone(item.confidence)} variant="secondary">
                      {Math.round(item.confidence * 100)}%
                    </Badge>
                    <Badge variant={item.basis === "database" ? "outline" : "secondary"}>
                      {item.basis === "database" ? "Database match" : "AI estimate — unverified"}
                    </Badge>
                    <Button
                      size="sm"
                      variant={edit.include ? "default" : "outline"}
                      className="ml-auto"
                      aria-pressed={edit.include}
                      disabled={!loggable || busy}
                      onClick={() =>
                        setEdits((prev) =>
                          prev.map((e, i) => (i === index ? { ...e, include: !e.include } : e))
                        )
                      }>
                      {edit.include ? "Will log" : "Skip"}
                    </Button>
                  </div>

                  {item.uncertaintyFactors.length > 0 && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      {item.uncertaintyFactors.join(" · ")}
                    </p>
                  )}
                  {!loggable && (
                    <p className="text-destructive mt-1 text-xs">
                      This item can&apos;t be logged automatically — add it manually from the
                      Manual tab.
                    </p>
                  )}

                  {loggable && (
                    <div className="mt-2 flex flex-wrap items-end gap-3">
                      <div className="w-28 space-y-1">
                        <Label htmlFor={`photo-qty-${index}`} className="text-xs">
                          Quantity ({item.unit})
                        </Label>
                        <Input
                          id={`photo-qty-${index}`}
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="any"
                          value={edit.qty}
                          disabled={busy || !edit.include}
                          onChange={(e) =>
                            setEdits((prev) =>
                              prev.map((x, i) => (i === index ? { ...x, qty: e.target.value } : x))
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-muted-foreground text-xs">Meal</span>
                        <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Meal for ${item.candidate}`}>
                          {MEAL_CHOICES.map((m) => (
                            <Button
                              key={m.value}
                              type="button"
                              size="sm"
                              variant={edit.meal === m.value ? "default" : "outline"}
                              aria-pressed={edit.meal === m.value}
                              disabled={busy || !edit.include}
                              onClick={() =>
                                setEdits((prev) =>
                                  prev.map((x, i) => (i === index ? { ...x, meal: m.value } : x))
                                )
                              }>
                              {m.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                      {preview && edit.include && (
                        <p className="text-muted-foreground text-xs tabular-nums" aria-live="polite">
                          ≈ <span className="text-foreground font-semibold">{preview.calories}</span>{" "}
                          kcal · P {preview.proteinG}g · C {preview.carbsG}g · F {preview.fatG}g
                        </p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="flex items-center justify-end gap-2">
            <Button onClick={() => void confirm()} disabled={busy || phase !== "results"}>
              {phase === "confirming" ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden /> Logging…
                </>
              ) : (
                "Confirm & log"
              )}
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Entries are logged for today. Quantities you change here teach EatWise your usual
            portions.
          </p>
        </div>
      )}
    </div>
  );
}
