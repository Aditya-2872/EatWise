import "server-only";

/** AI task kinds — also the `ai_analyses.type` values they map to. */
export type AiTask = "food_image" | "clarification" | "guidance" | "meal_plan";

export interface AiImage {
  /** Raw base64 (no data-URL prefix). */
  base64: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
}

export interface AiCallOptions {
  task: AiTask;
  system: string;
  prompt: string;
  image?: AiImage;
  temperature?: number;
  maxOutputTokens?: number;
  /** Hard timeout for the whole call (provider retry included). */
  timeoutMs?: number;
}

export interface AiCallResult {
  /** Model output text — expected to be a JSON document. */
  text: string;
  provider: "gemini" | "mock";
  model: string;
  tokensInput: number | null;
  tokensOutput: number | null;
  latencyMs: number;
}

export interface AiProvider {
  readonly name: "gemini" | "mock";
  /** One structured-output generation call. Must reject with AiProviderError on failure. */
  generateJson(opts: AiCallOptions): Promise<AiCallResult>;
}

/** Missing/invalid provider configuration — surfaced verbatim to the user (spec §42: never fake). */
export class AiConfigError extends Error {
  readonly kind = "config" as const;
  constructor(message: string) {
    super(message);
    this.name = "AiConfigError";
  }
}

/** Upstream provider failure. `retryable` drives the gateway's single retry. */
export class AiProviderError extends Error {
  readonly kind = "provider" as const;
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}

/** Model output failed Zod validation after parse. */
export class AiValidationError extends Error {
  readonly kind = "validation" as const;
  constructor(
    message: string,
    readonly rawText: string,
  ) {
    super(message);
    this.name = "AiValidationError";
  }
}

/** Convert any gateway error into a consistent API error body (spec §25 API rules). */
export function aiErrorBody(err: unknown): { status: number; body: { error: string; code: string } } {
  if (err instanceof AiConfigError) {
    return { status: 503, body: { error: err.message, code: "AI_CONFIG" } };
  }
  if (err instanceof AiValidationError) {
    return {
      status: 502,
      body: { error: "The AI returned an unusable answer. Please try again.", code: "AI_VALIDATION" },
    };
  }
  if (err instanceof AiProviderError) {
    if (err.status === 429) {
      return {
        status: 429,
        body: { error: "AI quota exhausted — the free daily model limit was reached. Try again tomorrow.", code: "AI_QUOTA" },
      };
    }
    return { status: 502, body: { error: err.message, code: "AI_PROVIDER" } };
  }
  return {
    status: 500,
    body: { error: "Unexpected AI failure.", code: "AI_UNKNOWN" },
  };
}
