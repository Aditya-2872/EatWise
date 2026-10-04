/**
 * Offline storage (spec §23): Dexie/IndexedDB for the food-log queue and
 * small read caches. NEVER store auth secrets here — identity always comes
 * from the server session cookie.
 */
import Dexie, { type Table } from "dexie";

export interface QueuedLogPayload {
  foodId: string;
  quantity: number;
  unit: string;
  mealType: string;
  source: string;
  /** ISO string; omitted means "now" at replay time. */
  loggedAt?: string;
}

export interface QueuedLog {
  id?: number;
  payload: QueuedLogPayload;
  queuedAt: string;
  attempts: number;
}

export interface KvEntry {
  key: string;
  value: unknown;
  updatedAt: string;
}

class EatWiseDB extends Dexie {
  logQueue!: Table<QueuedLog, number>;
  kv!: Table<KvEntry, string>;

  constructor() {
    super("eatwise");
    this.version(1).stores({
      logQueue: "++id, queuedAt",
      kv: "key",
    });
  }
}

export const db = new EatWiseDB();

/* ---------------- kv cache helpers ---------------- */

export async function kvSet(key: string, value: unknown): Promise<void> {
  try {
    await db.kv.put({ key, value, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.warn("[offline] kvSet failed:", err);
  }
}

export async function kvGet<T>(key: string): Promise<T | null> {
  try {
    const entry = await db.kv.get(key);
    return (entry?.value as T) ?? null;
  } catch {
    return null;
  }
}
