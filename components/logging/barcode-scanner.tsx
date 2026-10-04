"use client";

/**
 * Camera barcode scanner (spec §15). Uses the native BarcodeDetector where
 * available (Chrome/Edge/Android); otherwise lazy-loads the spec-compatible
 * `barcode-detector` ponyfill (zxing-wasm) so iOS Safari/Firefox also work.
 * Every failure path degrades to manual entry — scanning is never required.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, ScanBarcode, X } from "lucide-react";

import type { BarcodeDetector as PonyfillDetector } from "barcode-detector/ponyfill";
import { Button } from "@/components/ui/button";
import { normalizeBarcode } from "@/lib/barcode";

type DetectorLike = Pick<PonyfillDetector, "detect">;
type DetectorCtor = new (opts?: { formats?: string[] }) => DetectorLike;

const FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "itf",
  "codabar"
];

async function getDetectorCtor(): Promise<DetectorCtor | null> {
  const native = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
  if (native) return native;
  try {
    const mod = await import("barcode-detector/ponyfill");
    return mod.BarcodeDetector as unknown as DetectorCtor;
  } catch (err) {
    console.error("[barcode-scanner] ponyfill load failed:", err);
    return null;
  }
}

export interface BarcodeScannerProps {
  /** Called once with the normalized barcode; the scanner stops itself. */
  onDetected: (code: string) => void;
  onClose: () => void;
}

type ScannerState =
  | { kind: "starting" }
  | { kind: "scanning" }
  | { kind: "error"; message: string; canRetry: boolean }
  | { kind: "done" };

export function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const stoppedRef = useRef(false);
  const [state, setState] = useState<ScannerState>({ kind: "starting" });
  const [attempt, setAttempt] = useState(0);

  const stopCamera = useCallback(() => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    stoppedRef.current = false;
    let active = true;

    async function start() {
      setState({ kind: "starting" });

      if (!navigator.mediaDevices?.getUserMedia) {
        if (active) {
          setState({
            kind: "error",
            message:
              "Camera access requires HTTPS (or localhost). Enter the barcode manually instead.",
            canRetry: false
          });
        }
        return;
      }

      const Ctor = await getDetectorCtor();
      if (!stoppedRef.current && !Ctor) {
        setState({
          kind: "error",
          message:
            "Barcode scanning isn't supported in this browser right now. Please enter the barcode manually below.",
          canRetry: false
        });
        return;
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
          audio: false
        });
      } catch (err) {
        if (!active) return;
        const name = err instanceof DOMException ? err.name : "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          setState({
            kind: "error",
            message:
              "Camera permission was denied. Allow camera access in your browser settings and retry, or enter the barcode manually.",
            canRetry: true
          });
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          setState({
            kind: "error",
            message: "No camera was found on this device. Enter the barcode manually instead.",
            canRetry: false
          });
        } else {
          setState({ kind: "error", message: "The camera could not be started. Please retry.", canRetry: true });
        }
        return;
      }

      if (!active || stoppedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => {});
      }

      const detector = new Ctor!({ formats: FORMATS });
      setState({ kind: "scanning" });

      timerRef.current = window.setInterval(() => {
        if (busyRef.current || stoppedRef.current) return;
        const v = videoRef.current;
        if (!v || v.readyState < 2) return;
        busyRef.current = true;
        detector
          .detect(v)
          .then((codes) => {
            if (stoppedRef.current) return;
            for (const code of codes) {
              const normalized = normalizeBarcode(code.rawValue);
              if (normalized) {
                stoppedRef.current = true;
                setState({ kind: "done" });
                stopCamera();
                onDetected(normalized);
                return;
              }
            }
          })
          .catch(() => {
            /* transient detect() failures are fine — next tick retries */
          })
          .finally(() => {
            busyRef.current = false;
          });
      }, 220);
    }

    void start();

    return () => {
      active = false;
      stoppedRef.current = true;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, stopCamera]);

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="relative overflow-hidden rounded-md bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          aria-label="Camera view for barcode scanning"
          className="h-56 w-full object-cover"
        />
        {/* Scan frame overlay */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="border-primary/80 h-20 w-64 rounded-lg border-2 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        </div>

        {state.kind === "starting" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <p className="flex items-center gap-2 text-sm text-white">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Starting camera…
            </p>
          </div>
        )}
        {state.kind === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 p-4 text-center">
            <p className="text-sm text-white">{state.message}</p>
            <div className="flex gap-2">
              {state.canRetry && (
                <Button size="sm" variant="secondary" onClick={() => setAttempt((a) => a + 1)}>
                  <ScanBarcode aria-hidden /> Retry camera
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs" role="status" aria-live="polite">
          {state.kind === "scanning"
            ? "Point the camera at the barcode on the packaging."
            : state.kind === "done"
              ? "Barcode detected — looking it up…"
              : ""}
        </p>
        <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close scanner">
          <X aria-hidden /> Close
        </Button>
      </div>
    </div>
  );
}
