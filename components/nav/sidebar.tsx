"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { brand, sidebarNav } from "@/components/nav/nav-config";
import { cn } from "@/lib/utils";

interface SidebarProps {
  userEmail: string | null;
}

export function Sidebar({ userEmail }: SidebarProps) {
  const pathname = usePathname();
  const initials =
    userEmail
      ?.split("@")[0]
      ?.slice(0, 2)
      .toUpperCase() ?? "EW";

  return (
    <aside className="bg-card hidden h-screen w-64 shrink-0 flex-col border-r md:flex">
      <div className="flex h-16 items-center gap-2 px-5">
        <span
          aria-hidden
          className="text-primary-foreground flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-chart-1 shadow-md shadow-primary/25"
        >
          <brand.icon className="size-4" />
        </span>
        <span className="font-display text-lg font-semibold tracking-tight">{brand.name}</span>
      </div>
      <Separator />

      <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Main navigation">
        {sidebarNav.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/app/dashboard" && pathname.startsWith(item.href));
          return (
            <Button
              key={item.href}
              variant={active ? "secondary" : "ghost"}
              className={cn("w-full justify-start", active && "text-primary font-medium")}
              render={<Link href={item.href} aria-current={active ? "page" : undefined} />}>
              <item.icon />
              {item.label}
            </Button>
          );
        })}
      </nav>

      <Separator />
      <Link
        href="/app/settings"
        className="hover:bg-accent flex items-center gap-3 rounded-lg p-3 transition-colors">
        <Avatar className="size-9">
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{userEmail ?? "Account"}</p>
          <p className="text-muted-foreground text-xs">Settings & profile</p>
        </div>
      </Link>
    </aside>
  );
}
