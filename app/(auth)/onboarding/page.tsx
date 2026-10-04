import { redirect } from "next/navigation";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { getUserContext } from "@/lib/auth/session";

export const metadata = { title: "Set up your profile" };

export default async function OnboardingPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");

  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", ctx.userId)
    .maybeSingle();

  if (
    profile != null &&
    (profile as { onboarding_completed?: boolean }).onboarding_completed === true
  ) {
    redirect("/app/dashboard");
  }

  return <OnboardingWizard />;
}
