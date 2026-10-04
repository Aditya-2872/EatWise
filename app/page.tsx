import { redirect } from "next/navigation";

import { getUserContext } from "@/lib/auth/session";

/**
 * Landing route. EatWise is an app-first PWA: signed-in users go to the
 * dashboard, everyone else to login (which links to signup).
 */
export default async function LandingPage() {
  const ctx = await getUserContext();
  redirect(ctx ? "/app/dashboard" : "/login");
}
