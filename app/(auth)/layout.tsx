import Link from "next/link";
import { Leaf } from "lucide-react";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-4 py-10">
      {/* Ambient aurora — slow-drifting washes behind the card. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="animate-aurora bg-primary/15 dark:bg-primary/20 absolute -top-32 -right-24 size-96 rounded-full blur-3xl" />
        <div className="animate-aurora-slow bg-chart-3/15 absolute -bottom-40 -left-24 h-[28rem] w-[28rem] rounded-full blur-3xl" />
        <div className="animate-aurora bg-chart-2/10 absolute top-1/3 left-1/2 size-72 -translate-x-1/2 rounded-full blur-3xl [animation-delay:-9s]" />
      </div>

      <Link
        href="/"
        className="relative mb-6 flex animate-in fade-in slide-in-from-bottom-3 items-center gap-2 text-xl font-semibold tracking-tight text-foreground duration-700"
      >
        <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-xl shadow-lg shadow-primary/25">
          <Leaf className="size-5" aria-hidden="true" />
        </span>
        <span className="font-display">EatWise</span>
      </Link>
      <div className="relative w-full max-w-md animate-in fade-in slide-in-from-bottom-4 rounded-3xl border bg-card/85 p-6 shadow-xl shadow-primary/5 duration-700 backdrop-blur-xl [animation-delay:80ms] sm:p-8">
        {children}
      </div>
    </div>
  );
}
