"use client";

import { useRef, type PointerEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Subtle pointer-driven 3D tilt for hero cards.
 * - Transform-only (GPU composited), max a few degrees — presence, not circus.
 * - Disabled on touch devices (no hover) and for prefers-reduced-motion.
 * - The wrapper supplies perspective; the inner element rotates via CSS vars.
 */
export function TiltCard({
  children,
  className,
  maxDegrees = 3.5,
}: {
  children: ReactNode;
  className?: string;
  maxDegrees?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function setVars(rx: string, ry: string) {
    ref.current?.style.setProperty("--tilt-rx", rx);
    ref.current?.style.setProperty("--tilt-ry", ry);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5; // -0.5..0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setVars(`${(-py * maxDegrees).toFixed(2)}deg`, `${(px * maxDegrees).toFixed(2)}deg`);
  }

  function onPointerLeave() {
    setVars("0deg", "0deg");
  }

  return (
    <div className={cn("[perspective:900px]", className)}>
      <div
        ref={ref}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        className="h-full [transform:rotateX(var(--tilt-rx,0deg))_rotateY(var(--tilt-ry,0deg))] [transform-style:preserve-3d] [transition:transform_350ms_cubic-bezier(0.22,1,0.36,1)] motion-reduce:[transition:none]"
      >
        {children}
      </div>
    </div>
  );
}
