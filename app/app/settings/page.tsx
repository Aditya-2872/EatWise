import { getUserContext } from "@/lib/auth/session";
import { SettingsView, type SettingsData } from "@/components/settings/settings-view";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await getUserContext();
  if (!ctx) return null; // layout redirects

  const {
    data: { user }
  } = await ctx.supabase.auth.getUser();

  const { data: profileRaw } = await ctx.supabase
    .from("profiles")
    .select("display_name, timezone, height_cm, sex, date_of_birth")
    .eq("id", ctx.userId)
    .maybeSingle();

  const p = (profileRaw ?? null) as Record<string, unknown> | null;

  const data: SettingsData = {
    email: user?.email ?? null,
    displayName: p?.display_name == null ? null : String(p.display_name),
    timeZone: ctx.timeZone,
    heightCm: p?.height_cm == null ? null : Number(p.height_cm),
    sex: p?.sex == null ? null : String(p.sex),
    dateOfBirth: p?.date_of_birth == null ? null : String(p.date_of_birth)
  };

  return <SettingsView data={data} />;
}
