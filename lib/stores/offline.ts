/**
 * Offline sync status (spec §28 — Zustand owns "offline sync status").
 * Written only by lib/offline/queue.ts and components/pwa/offline-sync.tsx.
 */
import { create } from "zustand";

export interface OfflineState {
  /** Browser connectivity (navigator.onLine, event-driven). */
  online: boolean;
  /** Food logs waiting in IndexedDB to sync. */
  pending: number;
  /** A flush pass is currently running. */
  syncing: boolean;
}

export const useOfflineStore = create<OfflineState>(() => ({
  online: true,
  pending: 0,
  syncing: false
}));
