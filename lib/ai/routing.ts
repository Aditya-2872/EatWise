import "server-only";

import { serverEnv } from "@/lib/env";
import type { AiTask } from "./types";

/**
 * Model routing (spec §26): vision tasks go to the vision model, language
 * tasks to the language model. Both are configurable via env so providers
 * and tiers can be swapped without touching call sites. When env vars are
 * unset we default to a current free-tier Gemini flash model.
 *
 * Cost-control note: the free Gemini tier allows ~20 generateContent calls
 * per day per model. Routing vision and language to DIFFERENT models
 * therefore doubles the effective daily budget; routes additionally enforce
 * per-user rate limits.
 */
const DEFAULT_MODEL = "gemini-3.6-flash";

export function routeModel(task: AiTask): string {
  const env = serverEnv();
  if (task === "food_image") {
    return env.aiVisionModel ?? DEFAULT_MODEL;
  }
  return env.aiLanguageModel ?? env.aiVisionModel ?? DEFAULT_MODEL;
}

export function routeProviderName(): "gemini" | "mock" {
  return serverEnv().aiProvider;
}
