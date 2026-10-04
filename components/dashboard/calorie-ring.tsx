"use client";

/**
 * Calorie budget ring — pure SVG, no chart library needed for one donut.
 * Gradient stroke, spring-eased arc animation and a count-up number.
 * Over-target intake renders in the destructive palette.
 */
import { useId, useEffect } from "react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";

const SMOOTH_EASE = [0.22, 1, 0.36, 1] as const;

export function CalorieRing({
  consumed,
  target,
  size = 176
}: {
  consumed: number;
  target: number | null;
  size?: number;
}) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = target && target > 0 ? Math.min(consumed / target, 1.15) : 0;
  const over = target != null && consumed > target;
  const remaining = target != null ? target - consumed : null;
  const gradientId = useId();

  // Count-up: animate a motion value toward `consumed` on every change.
  const kcalMv = useMotionValue(0);
  const kcalText = useTransform(kcalMv, (v) => String(Math.round(v)));
  useEffect(() => {
    const controls = animate(kcalMv, consumed, { duration: 0.9, ease: SMOOTH_EASE });
    return controls.stop;
  }, [consumed, kcalMv]);

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      role="img"
      aria-label={
        target != null
          ? `${Math.round(consumed)} of ${target} kilocalories consumed, ${Math.abs(Math.round(remaining!))} kilocalories ${over ? "over" : "remaining"}`
          : `${Math.round(consumed)} kilocalories consumed, no target set`
      }>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            {over ? (
              <>
                <stop offset="0%" stopColor="oklch(0.7 0.19 22)" />
                <stop offset="100%" stopColor="oklch(0.58 0.22 27)" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="oklch(0.78 0.13 165)" />
                <stop offset="55%" stopColor="oklch(0.62 0.13 155)" />
                <stop offset="100%" stopColor="oklch(0.48 0.11 150)" />
              </>
            )}
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          stroke={`url(#${gradientId})`}
          style={{
            filter: over
              ? "drop-shadow(0 0 7px oklch(0.65 0.2 25 / 0.4))"
              : "drop-shadow(0 0 7px oklch(0.6 0.13 155 / 0.4))"
          }}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: 1.1, ease: SMOOTH_EASE }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <motion.span className="font-display text-4xl font-bold tabular-nums tracking-tight">
          {kcalText}
        </motion.span>
        <span className="text-muted-foreground text-xs">kcal eaten</span>
        {target != null && (
          <span className="mt-1 text-sm font-medium tabular-nums">
            {over ? (
              <span className="text-destructive">{Math.abs(Math.round(remaining!))} over</span>
            ) : (
              <span className="text-muted-foreground">{Math.round(remaining!)} left</span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
