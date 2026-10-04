"use client";

import { useTransition } from "react";
import Link from "next/link";
import { LogOut, Settings, Target } from "lucide-react";

import { logoutAction } from "@/app/(auth)/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useSessionEmail } from "@/components/nav/session-context";

export function UserMenu() {
  const email = useSessionEmail();
  const [loggingOut, startLogout] = useTransition();
  const initials =
    email
      ?.split("@")[0]
      ?.slice(0, 2)
      .toUpperCase() ?? "EW";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" className="rounded-full px-1.5" aria-label="Account menu" />
        }>
        <Avatar className="size-8">
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {/* Base UI: GroupLabel (what DropdownMenuLabel renders) requires a Group context */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="text-muted-foreground block text-xs font-normal">Signed in as</span>
            <span className="block truncate text-sm font-medium">{email ?? "—"}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/app/settings" />}>
          <Settings aria-hidden />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/app/goals" />}>
          <Target aria-hidden />
          Goals & targets
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={loggingOut}
          onSelect={() => startLogout(() => logoutAction())}>
          <LogOut aria-hidden />
          {loggingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
