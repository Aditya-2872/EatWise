import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/nav/sidebar";
import { Topbar } from "@/components/nav/topbar";
import { BottomNav } from "@/components/nav/bottom-nav";
import { SessionEmailProvider } from "@/components/nav/session-context";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();

  const onboarded =
    profile != null &&
    (profile as { onboarding_completed?: boolean }).onboarding_completed === true;
  if (!onboarded) redirect("/onboarding");

  const email = user.email ?? null;

  return (
    <SessionEmailProvider email={email}>
      <div className="flex min-h-screen">
        <Sidebar userEmail={email} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-24 md:px-6 md:pb-10">
            {children}
          </main>
        </div>
        <BottomNav />
      </div>
    </SessionEmailProvider>
  );
}
