"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/nav/user-menu";
import { Button } from "@/components/ui/button";

export function Topbar() {
  return (
    <header className="bg-background/80 sticky top-0 z-30 flex h-16 items-center justify-end gap-2 border-b px-4 backdrop-blur md:px-6">
      <Button render={<Link href="/app/log" />} size="sm">
        <Plus aria-hidden />
        Log Food
        <span className="sr-only">Log a food entry</span>
      </Button>
      <ThemeToggle />
      <UserMenu />
    </header>
  );
}
