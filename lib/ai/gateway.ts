import "server-only";

import type { z } from "zod";

import { geminiProvider } from "./providers/gemini";
import { mockProvider } from "./providers/mock";
import {
  CLARIFY_SYSTEM,
  GUIDANCE_SYSTEM,
  MEAL_PLAN_SYSTEM,
  VISION_SYSTEM,
  clarifyPrompt,
  guidancePrompt,
  mealPlanPrompt,
  visionPrompt,
} from "./prompts";
import { routeProviderName } from "./routing";
import {
  foodImageAnalysisSchema,
  guidanceSchema,
  mealPlanSchema,
  type FoodImageAnalysis,
  type Guidance,
  type MealPlan,
} from "./schemas";
import {
  AiValidationError,
  type AiCallResult,
  type AiImage,
  type AiProvider,
} from "./types";

/**
 * AI Provider Gateway (spec §26). Application code calls THIS module — never
 * a vendor SDK. Providers are swappable via AI_PROVIDER (gemini | mock),
 * models via AI_VISION_MODEL / AI_LANGUAGE_MODEL (see routing.ts). Every
 * workflow: build prompt → call provider (retries/timeouts inside provider)
 * → strip-fence JSON parse → Zod validate → typed result + usage metadata.
 */

export interface AiMeta {
  provider: string;
  model: string;
  tokensInput: number | null;
  tokensOutput: number | null;
  latencyMs: number;
}

export interface AiGatewayResult<T> {
  data: T;
  meta: AiMeta;
}

export function getProvider(): AiProvider {
  return routeProviderName() === "mock" ? mockProvider : geminiProvider;
}

function toMeta(res: AiCallResult): AiMeta {
  return {
    provider: res.provider,
    model: res.model,
    tokensInput: res.tokensInput,
    tokensOutput: res.tokensOutput,
    latencyMs: res.latencyMs,
  };
}

/**
 * Strict JSON extraction + Zod validation of model output. Generic over the
 * schema (not its output type) so `.catch()`/`.nullish()` refinements keep
 * their exact inferred output shape.
 */
export function parseAiJson<S extends z.ZodTypeAny>(
  text: string,
  schema: S,
  taskName: string,
): z.output<S> {
  let cleaned = text.trim();

  // Strip markdown fences if the model wrapped its answer despite instructions.
  const fence = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) cleaned = fence[1].trim();

  // Slice to the outermost JSON object when extra prose leaked in.
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first >= 0 && last > first && (first > 0 || last < cleaned.length - 1)) {
    cleaned = cleaned.slice(first, last + 1);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(cleaned);
  } catch {
    throw new AiValidationError(`${taskName}: model output was not valid JSON.`, text);
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new AiValidationError(`${taskName}: schema validation failed — ${issues}`, text);
  }
  return parsed.data;
}

/* ------------------------------------------------------------------ */
/* Workflows                                                           */
/* ------------------------------------------------------------------ */

export async function analyzeFoodImage(
  image: AiImage,
  opts: { mealType?: string; hints?: string } = {},
): Promise<AiGatewayResult<FoodImageAnalysis>> {
  const res = await getProvider().generateJson({
    task: "food_image",
    system: VISION_SYSTEM,
    prompt: visionPrompt(opts),
    image,
    temperature: 0.2,
    maxOutputTokens: 3072,
  });
  return { data: parseAiJson(res.text, foodImageAnalysisSchema, "food image analysis"), meta: toMeta(res) };
}

export async function clarifyFoodAnalysis(
  analysis: FoodImageAnalysis,
  question: string,
  answer: string,
): Promise<AiGatewayResult<FoodImageAnalysis>> {
  const res = await getProvider().generateJson({
    task: "clarification",
    system: CLARIFY_SYSTEM,
    prompt: clarifyPrompt({ analysis, question, answer }),
    temperature: 0.2,
    maxOutputTokens: 3072,
  });
  return { data: parseAiJson(res.text, foodImageAnalysisSchema, "clarification"), meta: toMeta(res) };
}

export async function requestGuidance(
  question: string,
  contextJson: string,
): Promise<AiGatewayResult<Guidance>> {
  const res = await getProvider().generateJson({
    task: "guidance",
    system: GUIDANCE_SYSTEM,
    prompt: guidancePrompt({ question, contextJson }),
    temperature: 0.4,
    maxOutputTokens: 2048,
  });
  return { data: parseAiJson(res.text, guidanceSchema, "guidance"), meta: toMeta(res) };
}

export async function requestMealPlan(
  mealTypes: string[],
  contextJson: string,
): Promise<AiGatewayResult<MealPlan>> {
  const res = await getProvider().generateJson({
    task: "meal_plan",
    system: MEAL_PLAN_SYSTEM,
    prompt: mealPlanPrompt({ mealTypes, contextJson }),
    temperature: 0.5,
    maxOutputTokens: 2048,
  });
  return { data: parseAiJson(res.text, mealPlanSchema, "meal plan"), meta: toMeta(res) };
}
