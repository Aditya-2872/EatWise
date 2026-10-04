/**
 * Offline food-log queue (spec §23): actions captured while the network is
 * down are stored in IndexedDB (Dexie) and replayed through the SAME server
 * action when connectivity returns. No auth data is ever persisted locally —
 * replay runs under whatever session the user has at sync time.
 */
import { createLogAction } from "@/app/app/actions/logging";

import { db, type QueuedLogPayload } from "./db";
import { useOfflineStore } from "@/lib/stores/offline";

const MAX_ATTEMPTS = 5;

let flushing = false;

export async function enqueueLog(payload: QueuedLogPayload): Promise<void> {
  await db.logQueue.add({ payload, queuedAt: new Date().toISOString(), attempts: 0 });
  await refreshPendingCount();
}

export async function refreshPendingCount(): Promise<number> {
  try {
    const n = await db.logQueue.count();
    useOfflineStore.setState({ pending: n });
    return n;
  } catch {
    return 0;
  }
}

/**
 * Replay queued logs oldest-first. `onSynced` fires once when at least one
 * log synced (caller invalidates day/progress queries). Network failures
 * abort the pass and keep items queued; server rejections increment attempts
 * and the item is dropped after MAX_ATTEMPTS so a bad row can't wedge the
 * queue forever.
 */
export async function flushLogQueue(onSynced?: (count: number) => void): Promise<void> {
  if (flushing) return;
  flushing = true;
  useOfflineStore.setState({ syncing: true });
  let synced = 0;
  try {
    for (;;) {
      const item = await db.logQueue.orderBy("queuedAt").first();
      if (!item || item.id == null) break;

      let res: Awaited<ReturnType<typeof createLogAction>>;
      try {
        res = await createLogAction(item.payload);
      } catch {
        // Network still unavailable — stop; the next online event retries.
        break;
      }

      if (res.ok) {
        await db.logQueue.delete(item.id);
        synced += 1;
        continue;
      }

      const attempts = (item.attempts ?? 0) + 1;
      if (attempts >= MAX_ATTEMPTS) {
        console.warn("[offline] dropping queued log after repeated rejections:", res.error);
        await db.logQueue.delete(item.id);
      } else {
        await db.logQueue.update(item.id, { attempts });
      }
      break;
    }
    if (synced > 0) onSynced?.(synced);
  } finally {
    flushing = false;
    useOfflineStore.setState({ syncing: false });
    await refreshPendingCount();
  }
}
