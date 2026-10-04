import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level loading state for /app/* — mirrors the dashboard shape so the
 * layout never "jumps" when data lands. Shown during server navigation.
 */
export default function AppLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Skeleton className="h-80 rounded-xl md:col-span-2" />
        <div className="space-y-4 rounded-xl border bg-card p-6 md:col-span-3">
          <Skeleton className="h-5 w-36" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    </div>
  );
}
