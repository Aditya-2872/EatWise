"use client";

/**
 * Install prompt handling (spec §23). Captures `beforeinstallprompt` and
 * renders an install button only when the browser says the app is actually
 * installable — feature-detected, never assumed. iOS Safari (no prompt event)
 * shows the manual "Share → Add to Home Screen" hint instead.
 */
import { useEffect, useState } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIosSafari(): boolean {
  const ua = window.navigator.userAgent;
  return /iP(hone|ad|od)/.test(ua) || (ua.includes("Macintosh") && "ontouchend" in document);
}

export function InstallButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true);
      return;
    }
    setIos(isIosSafari());

    function onPrompt(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setDeferred(null);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) {
    return (
      <p className="text-muted-foreground text-sm">
        EatWise is installed on this device. 🎉
      </p>
    );
  }

  if (deferred) {
    return (
      <Button
        variant="outline"
        onClick={async () => {
          await deferred.prompt();
          const { outcome } = await deferred.userChoice;
          if (outcome === "dismissed") setDeferred(null);
        }}>
        <Download aria-hidden /> Install app
      </Button>
    );
  }

  if (ios) {
    return (
      <p className="text-muted-foreground text-sm">
        To install on iOS: tap <span className="font-medium">Share</span> in Safari, then{" "}
        <span className="font-medium">Add to Home Screen</span>.
      </p>
    );
  }

  return (
    <p className="text-muted-foreground text-sm">
      Install from your browser&apos;s menu (⋮ → &ldquo;Install app&rdquo;) to use EatWise
      offline and as a standalone app.
    </p>
  );
}
