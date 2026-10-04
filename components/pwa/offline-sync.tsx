"use client";

/**
 * Offline sync driver + status banner (spec §23/§29). Listens for
 * online/offline events, flushes the IndexedDB log queue when connectivity
 * returns, and surfaces the exact network-failure copy from the spec:
 * "You're offline. Your log will be saved and synced when you're back online."
 */
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { CloudOff, RefreshCw } from "lucide-react";

import { flushLogQueue, refreshPendingCount } from "@/lib/offline/queue";
import { useOfflineStore } from "@/lib/stores/offline";

export function OfflineSync() {
  const queryClient = useQueryClient();
  const online = useOfflineStore((s) => s.online);
  const pending = useOfflineStore((s) => s.pending);
  const syncing = useOfflineStore((s) => s.syncing);

  useEffect(() => {
    function onSynced(count: number) {
      toast.success(
        count === 1 ? "1 offline log synced." : `${count} offline logs synced.`
      );
      void queryClient.invalidateQueries();
    }

    useOfflineStore.setState({ online: navigator.onLine });
    void refreshPendingCount().then(() => {
      if (navigator.onLine) void flushLogQueue(onSynced);
    });

    function goOnline() {
      useOfflineStore.setState({ online: true });
      void flushLogQueue(onSynced);
    }
    function goOffline() {
      useOfflineStore.setState({ online: false });
    }

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [queryClient]);

  if (online && pending === 0 && !syncing) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 px-4 py-2 text-center text-sm font-medium shadow-md">
      {!online ? (
        <p className="bg-amber-500 text-amber-950 flex w-full items-center justify-center gap-2 rounded-b-lg px-3 py-1.5">
          <CloudOff className="size-4 shrink-0" aria-hidden />
          You&apos;re offline. Your logs will be saved and synced when you&apos;re back online.
        </p>
      ) : syncing ? (
        <p className="bg-primary text-primary-foreground flex w-full items-center justify-center gap-2 rounded-b-lg px-3 py-1.5">
          <RefreshCw className="size-4 animate-spin shrink-0" aria-hidden />
          Syncing {pending} saved log{pending === 1 ? "" : "s"}…
        </p>
      ) : (
        <p className="bg-muted text-muted-foreground flex w-full items-center justify-center gap-2 rounded-b-lg px-3 py-1.5">
          <CloudOff className="size-4 shrink-0" aria-hidden />
          {pending} log{pending === 1 ? "" : "s"} waiting to sync
        </p>
      )}
    </div>
  );
}
