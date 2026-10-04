import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AiTask } from "./types";

/**
 * AI usage tracking (spec §26 "AI cost controls"): every gateway call is
 * recorded in `ai_analyses` with model, tokens, latency, status and the
 * validated response JSON. Recording failures never break the request —
 * losing telemetry is acceptable, losing the user's analysis is not.
 */

export interface AiUsageInput {
  type: AiTask;
  provider: string;
  model: string;
  requestMetadata?: Record<string, unknown>;
  responseJson?: Record<string, unknown>;
  confidence?: number | null;
  status: "succeeded" | "failed" | "timeout" | "rejected";
  errorCode?: string | null;
  tokensInput?: number | null;
  tokensOutput?: number | null;
  latencyMs?: number | null;
}

/** Insert a usage row; returns its id (needed to link logs) or null. */
export async function recordAiAnalysis(
  supabase: SupabaseClient,
  userId: string,
  input: AiUsageInput,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("ai_analyses")
    .insert({
      user_id: userId,
      type: input.type,
      model_provider: input.provider,
      model_name: input.model,
      request_metadata: input.requestMetadata ?? {},
      response_json: input.responseJson ?? {},
      confidence: input.confidence ?? null,
      status: input.status,
      error_code: input.errorCode ?? null,
      tokens_input: input.tokensInput ?? null,
      tokens_output: input.tokensOutput ?? null,
      latency_ms: input.latencyMs ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[ai/usage] recordAiAnalysis failed:", error?.message);
    return null;
  }
  return data.id as string;
}

/**
 * Personal-food-model learning signal (spec §5): when the user corrects an
 * AI estimate before confirming, store original vs corrected value.
 */
export async function recordAiCorrection(
  supabase: SupabaseClient,
  userId: string,
  input: {
    analysisId: string | null;
    fieldName: string;
    originalValue: unknown;
    correctedValue: unknown;
  },
): Promise<void> {
  const { error } = await supabase.from("ai_corrections").insert({
    user_id: userId,
    analysis_id: input.analysisId,
    field_name: input.fieldName,
    original_value: input.originalValue ?? null,
    corrected_value: input.correctedValue ?? null,
  });
  if (error) {
    console.error("[ai/usage] recordAiCorrection failed:", error.message);
  }
}
