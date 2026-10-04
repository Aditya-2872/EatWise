"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Camera, ScanBarcode } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FoodItemRow } from "@/types/food";

/** Camera/scanner code is dynamically imported (spec §34) — never in the main bundle. */
const BarcodeScanner = dynamic(
  () => import("@/components/logging/barcode-scanner").then((m) => m.BarcodeScanner),
  { ssr: false, loading: () => <p className="text-muted-foreground text-sm">Loading scanner…</p> }
);

interface BarcodePanelProps {
  onFound: (food: FoodItemRow) => void;
}

/**
 * Barcode entry (spec §15): camera scan when available, manual EAN/UPC entry
 * always. Both resolve through the same server-side cache → Open Food Facts
 * pipeline, so external APIs are never called from the client.
 */
export function BarcodePanel({ onFound }: BarcodePanelProps) {
  const [code, setCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [state, setState] = useState<
    { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function lookup(raw?: string) {
    const trimmed = (raw ?? code).trim();
    if (!/^\d{6,14}$/.test(trimmed)) {
      setState({ kind: "error", message: "Barcode must be 6–14 digits." });
      return;
    }
    setState({ kind: "loading" });
    try {
      const res = await fetch(`/api/products/barcode/${encodeURIComponent(trimmed)}`);
      const body = (await res.json()) as { food?: FoodItemRow | null; error?: string };
      if (res.status === 404) {
        setState({
          kind: "error",
          message:
            "Product not found for this barcode. You can add it manually from the Manual tab."
        });
        return;
      }
      if (!res.ok || !body.food) {
        setState({ kind: "error", message: body.error ?? "Barcode lookup failed." });
        return;
      }
      setState({ kind: "idle" });
      setCode(trimmed);
      setScanning(false);
      onFound(body.food);
    } catch {
      setState({ kind: "error", message: "Network error — please try again." });
    }
  }

  return (
    <div className="space-y-4">
      {scanning && (
        <BarcodeScanner
          onDetected={(detected) => {
            setCode(detected);
            void lookup(detected);
          }}
          onClose={() => setScanning(false)}
        />
      )}

      <div className="flex items-end gap-3">
        <div className="flex-1 space-y-2">
          <Label htmlFor="barcode">Product barcode</Label>
          <Input
            id="barcode"
            type="text"
            inputMode="numeric"
            pattern="\d*"
            maxLength={14}
            placeholder="8901234567890"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void lookup();
              }
            }}
            aria-describedby="barcode-help"
          />
          <p id="barcode-help" className="text-muted-foreground text-xs">
            Enter the EAN/UPC digits from the packaging, or scan with your camera.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setScanning((s) => !s)}
            aria-pressed={scanning}
            aria-label={scanning ? "Close camera scanner" : "Scan barcode with camera"}>
            <Camera aria-hidden />
            {scanning ? "Stop" : "Scan"}
          </Button>
          <Button onClick={() => void lookup()} disabled={state.kind === "loading"}>
            <ScanBarcode aria-hidden />
            {state.kind === "loading" ? "Looking up…" : "Look up"}
          </Button>
        </div>
      </div>

      {state.kind === "error" && (
        <p role="alert" className="text-destructive text-sm">
          {state.message}
        </p>
      )}
    </div>
  );
}
