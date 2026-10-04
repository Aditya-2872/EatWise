/**
 * Minimal in-memory sliding-window rate limiter.
 *
 * Per-server-instance only (fine for a single-instance student MVP).
 * Documented in README as a known simplification; a production multi-instance
 * deployment would use Redis/Upstash.
 */
const windows = new Map<string, number[]>();

export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const cutoff = now - opts.windowMs;
  const hits = (windows.get(key) ?? []).filter((t) => t > cutoff);

  if (hits.length >= opts.limit) {
    windows.set(key, hits);
    const retryAfterSec = Math.max(1, Math.ceil((hits[0] + opts.windowMs - now) / 1000));
    return { ok: false, retryAfterSec };
  }

  hits.push(now);
  windows.set(key, hits);

  // Periodic cleanup to avoid unbounded growth.
  if (windows.size > 1000) {
    for (const [k, v] of windows) {
      const fresh = v.filter((t) => t > cutoff);
      if (fresh.length === 0) windows.delete(k);
      else windows.set(k, fresh);
    }
  }
  return { ok: true, retryAfterSec: 0 };
}
