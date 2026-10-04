import { redirect } from "next/navigation";

/** `/app` is the authenticated root — the dashboard is home (spec §App routes). */
export default function AppIndexPage() {
  redirect("/app/dashboard");
}
