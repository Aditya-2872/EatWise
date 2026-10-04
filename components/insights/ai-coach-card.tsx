"use client";

/**
 * AI nutrition coach (spec §19): free-form questions answered with the user's
 * real intake/progress context attached server-side. Answers are guidance
 * only — every number in them is illustrative, never written to logs.
 */
import { useState } from "react";
import { Loader2, MessageCircleQuestion, Send, Sparkles, Stethoscope } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { GuidanceResponse } from "@/types/ai";

const SUGGESTED_QUESTIONS = [
  "Why am I not losing weight even though I eat less?",
  "What should my next meal be to hit my protein target?",
  "Is my current diet good for muscle gain?",
  "How can I reduce late-night snacking?"
];

async function apiError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function AiCoachCard() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ question: string; response: GuidanceResponse } | null>(null);

  async function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/guidance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed })
      });
      if (!res.ok) {
        setError(await apiError(res, "Could not reach the AI coach."));
        return;
      }
      setResult({ question: trimmed, response: (await res.json()) as GuidanceResponse });
      setQuestion("");
    } catch {
      setError("Network error while asking the coach. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const g = result?.response.guidance;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="text-primary size-4" aria-hidden /> AI nutrition coach
        </CardTitle>
        <CardDescription>
          Ask anything about your diet — answers use your real intake and progress data. Guidance
          only; it never writes numbers to your diary.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(question);
          }}>
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={400}
            placeholder="e.g. How much protein should I eat on rest days?"
            aria-label="Question for the AI coach"
            disabled={loading}
          />
          <Button type="submit" disabled={loading || question.trim().length < 3} aria-label="Ask">
            {loading ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
          </Button>
        </form>

        {!result && (
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_QUESTIONS.map((q) => (
              <Button
                key={q}
                type="button"
                size="sm"
                variant="outline"
                className="h-auto whitespace-normal py-1.5 text-left text-xs font-normal"
                disabled={loading}
                onClick={() => void ask(q)}>
                <MessageCircleQuestion aria-hidden /> {q}
              </Button>
            ))}
          </div>
        )}

        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}

        {loading && !result && (
          <p className="text-muted-foreground flex items-center gap-2 text-sm" aria-live="polite">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Thinking about your data…
          </p>
        )}

        {g && result && (
          <div className="space-y-3" aria-live="polite">
            <p className="text-sm font-medium">You asked: “{result.question}”</p>

            {g.needs_medical_advice && (
              <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                <Stethoscope className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                This touches on medical territory — please consult a doctor or registered
                dietitian. EatWise does not diagnose or treat conditions.
              </p>
            )}

            <div className="text-sm leading-relaxed whitespace-pre-line">{g.answer}</div>

            {g.key_points.length > 0 && (
              <ul className="space-y-1.5">
                {g.key_points.map((p, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <Badge variant="secondary" className="mt-0.5 h-4 shrink-0 px-1.5 text-[10px]">
                      {i + 1}
                    </Badge>
                    <span className="text-muted-foreground leading-relaxed">{p}</span>
                  </li>
                ))}
              </ul>
            )}

            {g.suggestions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold tracking-wide uppercase">Suggestions</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {g.suggestions.map((s, i) => (
                    <div key={i} className="bg-muted/60 rounded-lg p-3 text-sm">
                      <p className="font-medium">{s.title}</p>
                      <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{s.reason}</p>
                      {(s.estimated_calories != null || s.estimated_protein_g != null) && (
                        <p className="text-muted-foreground mt-1 text-xs tabular-nums">
                          ≈ {s.estimated_calories ?? "—"} kcal
                          {s.estimated_protein_g != null ? ` · ${Math.round(s.estimated_protein_g)} g protein` : ""}{" "}
                          (illustrative)
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button size="sm" variant="ghost" onClick={() => setResult(null)} disabled={loading}>
                Ask another question
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
