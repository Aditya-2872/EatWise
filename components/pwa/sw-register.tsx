"use client";

/**
 * Registers /sw.js — production only. In dev, a service worker would serve
 * stale shells/chunks across hot reloads (the classic cache-first footgun),
 * so registration is deliberately skipped there.
 */
import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("[pwa] service worker registration failed:", err);
    });
  }, []);

  return null;
}
