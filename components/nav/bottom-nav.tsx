"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { bottomNav } from "@/components/nav/nav-config";
import { cn } from "@/lib/utils";

/** Mobile-only fixed bottom navigation (Home · Log · Progress · Insights · Profile). */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="bg-card/95 supports-[backdrop-filter]:bg-card/80 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="grid grid-cols-5">
        {bottomNav.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}>
                <item.icon
                  className={cn(
                    "size-5 transition-transform duration-300",
                    active && "scale-110 ease-spring"
                  )}
                  aria-hidden
                />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
