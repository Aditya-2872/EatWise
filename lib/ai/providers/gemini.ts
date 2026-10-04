import "server-only";

import { serverEnv } from "@/lib/env";
import { routeModel } from "../routing";
import {
  AiConfigError,
  AiProviderError,
  type AiCallOptions,
  type AiCallResult,
  type AiProvider,
} from "../types";

/**
 * Gemini REST adapter (no vendor SDK — plain fetch, spec §7 "AI").
 *
 * Hard-won behaviors baked in here:
 * - Gemini thinking models may reject `generationConfig.thinkingConfig` with a
 *   bare 400 INVALID_ARGUMENT that never names the field → on ANY 400, retry
 *   once without thinkingConfig before giving up.
 * - Thinking-model responses can contain `thought` parts → concatenate only
 *   non-thought text parts.
 * - Free tier is ~20 generateContent requests/day per model → never retry a
 *   429; surface it as a quota error the UI can explain honestly.
 */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

interface GeminiPart {
  text?: string;
  thought?: boolean;
  inline_data?: { mime_type: string; data: string };
}

interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  error?: { code?: number; message?: string; status?: string };
}

function defaultTimeoutMs(task: AiCallOptions["task"]): number {
  return task === "food_image" ? 45_000 : 30_000;
}

function truncate(s: string, n = 300): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export const geminiProvider: AiProvider = {
  name: "gemini",

  async generateJson(opts: AiCallOptions): Promise<AiCallResult> {
    const env = serverEnv();
    const apiKey = env.aiApiKey;
    if (!apiKey) {
      throw new AiConfigError(
        "AI_API_KEY is not set on the server. Add your Gemini API key to .env.local (AI_API_KEY=…) and restart the server. AI features are disabled until then.",
      );
    }

    const model = routeModel(opts.task);
    const url = `${ENDPOINT}/${encodeURIComponent(model)}:generateContent`;
    const timeoutMs = opts.timeoutMs ?? defaultTimeoutMs(opts.task);
    const started = Date.now();

    const userParts: GeminiPart[] = [];
    if (opts.image) {
      userParts.push({
        inline_data: { mime_type: opts.image.mimeType, data: opts.image.base64 },
      });
    }
    userParts.push({ text: opts.prompt });

    const generationConfigBase = {
      temperature: opts.temperature ?? 0.2,
      maxOutputTokens: opts.maxOutputTokens ?? 2048,
      responseMimeType: "application/json" as const,
    };

    let withThinking = true; // thinkingBudget 0 keeps structured extraction fast (~1s vs ~28s)
    let usedRetryableRetry = false;
    let lastErr: AiProviderError | null = null;

    for (let attempt = 0; attempt < 4; attempt++) {
      const body = withThinking
        ? {
            systemInstruction: { parts: [{ text: opts.system }] },
            contents: [{ role: "user", parts: userParts }],
            generationConfig: {
              ...generationConfigBase,
              thinkingConfig: { thinkingBudget: 0 },
            },
          }
        : {
            systemInstruction: { parts: [{ text: opts.system }] },
            contents: [{ role: "user", parts: userParts }],
            generationConfig: generationConfigBase,
          };

      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (err) {
        const timedOut = err instanceof Error && err.name === "TimeoutError";
        lastErr = new AiProviderError(
          timedOut
            ? `The AI request timed out after ${Math.round(timeoutMs / 1000)}s. Try again.`
            : "Could not reach the AI provider. Check the server's network connection.",
          undefined,
          true,
        );
        if (!usedRetryableRetry) {
          usedRetryableRetry = true;
          continue;
        }
        break;
      }

      // Bare 400 → drop thinkingConfig once (see file header).
      if (res.status === 400 && withThinking) {
        withThinking = false;
        continue;
      }

      if (res.status === 429) {
        throw new AiProviderError(
          "AI daily quota exhausted (HTTP 429). The free Gemini tier allows ~20 requests/day per model — try again tomorrow or set a paid AI_API_KEY.",
          429,
          false,
        );
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const retryable = res.status >= 500;
        lastErr = new AiProviderError(
          `AI provider returned HTTP ${res.status}: ${truncate(text)}`,
          res.status,
          retryable,
        );
        if (retryable && !usedRetryableRetry) {
          usedRetryableRetry = true;
          continue;
        }
        break;
      }

      let json: GeminiResponse;
      try {
        json = (await res.json()) as GeminiResponse;
      } catch {
        lastErr = new AiProviderError("AI provider returned a malformed response.", undefined, true);
        if (!usedRetryableRetry) {
          usedRetryableRetry = true;
          continue;
        }
        break;
      }

      if (json.error) {
        throw new AiProviderError(
          `AI provider error: ${json.error.message ?? json.error.status ?? "unknown"}`,
          json.error.code,
          (json.error.code ?? 500) >= 500,
        );
      }

      const candidate = json.candidates?.[0];
      const finish = candidate?.finishReason;
      if (finish === "SAFETY" || finish === "PROHIBITED_CONTENT") {
        throw new AiProviderError(
          "The AI safety filter rejected this image. Try a clearer photo of just the food.",
          undefined,
          false,
        );
      }

      // Thinking models: only non-thought parts carry the answer.
      const text = (candidate?.content?.parts ?? [])
        .filter((p) => !p.thought && typeof p.text === "string")
        .map((p) => p.text as string)
        .join("");

      if (!text.trim()) {
        lastErr = new AiProviderError(
          `The AI returned an empty answer (finishReason: ${finish ?? "unknown"}).`,
          undefined,
          true,
        );
        if (!usedRetryableRetry) {
          usedRetryableRetry = true;
          continue;
        }
        break;
      }

      return {
        text,
        provider: "gemini",
        model,
        tokensInput: json.usageMetadata?.promptTokenCount ?? null,
        tokensOutput: json.usageMetadata?.candidatesTokenCount ?? null,
        latencyMs: Date.now() - started,
      };
    }

    throw lastErr ?? new AiProviderError("The AI request failed.", undefined, false);
  },
};
