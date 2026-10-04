"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";

import { updateProfileAction } from "@/app/app/actions/goals";
import { logoutAction } from "@/app/(auth)/actions";
import { InstallButton } from "@/components/pwa/install-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export interface SettingsData {
  email: string | null;
  displayName: string | null;
  timeZone: string;
  heightCm: number | null;
  sex: string | null;
  dateOfBirth: string | null;
}

const COMMON_TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Australia/Sydney",
  "UTC"
];

export function SettingsView({ data }: { data: SettingsData }) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [displayName, setDisplayName] = useState(data.displayName ?? "");
  const [timeZone, setTimeZone] = useState(data.timeZone);
  const [heightCm, setHeightCm] = useState(data.heightCm != null ? String(data.heightCm) : "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loggingOut, startLogout] = useTransition();

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileError(null);
    const height = heightCm.trim() === "" ? undefined : Number(heightCm);
    if (height !== undefined && (!Number.isFinite(height) || height < 120 || height > 230)) {
      setProfileError("Height must be between 120 and 230 cm.");
      return;
    }
    setSavingProfile(true);
    const res = await updateProfileAction({
      ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
      timeZone,
      ...(height !== undefined ? { heightCm: height } : {})
    });
    setSavingProfile(false);
    if (!res.ok) {
      setProfileError(res.error);
      toast.error(res.error);
      return;
    }
    toast.success("Profile saved");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">Profile, appearance and account.</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>
            Signed in as {data.email ?? "—"}
            {data.sex ? ` · sex: ${data.sex}` : ""}
            {data.dateOfBirth ? ` · born: ${data.dateOfBirth}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="display-name">Display name</Label>
                <Input
                  id="display-name"
                  maxLength={60}
                  placeholder="Your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height-cm">Height (cm)</Label>
                <Input
                  id="height-cm"
                  type="number"
                  inputMode="numeric"
                  min={120}
                  max={230}
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  list="timezone-options"
                  value={timeZone}
                  onChange={(e) => setTimeZone(e.target.value)}
                  placeholder="Asia/Kolkata"
                />
                <datalist id="timezone-options">
                  {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz} value={tz} />
                  ))}
                </datalist>
                <p className="text-muted-foreground text-xs">
                  Used to decide where day boundaries fall for totals and charts. Height changes
                  apply to targets the next time you save your goal.
                </p>
              </div>
            </div>
            {profileError && (
              <p role="alert" className="text-destructive text-sm">
                {profileError}
              </p>
            )}
            <div className="flex justify-end">
              <Button type="submit" disabled={savingProfile}>
                {savingProfile ? "Saving…" : "Save profile"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2" role="group" aria-label="Theme">
            <Button
              variant={resolvedTheme === "light" ? "default" : "outline"}
              size="sm"
              onClick={() => setTheme("light")}>
              <Sun aria-hidden />
              Light
            </Button>
            <Button
              variant={resolvedTheme === "dark" ? "default" : "outline"}
              size="sm"
              onClick={() => setTheme("dark")}>
              <Moon aria-hidden />
              Dark
            </Button>
            <Button
              variant={resolvedTheme === "system" ? "default" : "outline"}
              size="sm"
              onClick={() => setTheme("system")}>
              System
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* App (PWA) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">App</CardTitle>
          <CardDescription>
            Install EatWise for offline access. Logs saved without a connection are queued on
            this device and sync automatically when you&apos;re back online.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <InstallButton />
        </CardContent>
      </Card>

      <Separator />

      {/* Account */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>
            Your food logs, custom foods and AI analyses are private to your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => startLogout(() => logoutAction())}
            disabled={loggingOut}>
            <LogOut aria-hidden />
            {loggingOut ? "Signing out…" : "Sign out"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
