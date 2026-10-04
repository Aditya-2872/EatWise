import Link from "next/link";
import { ChefHat } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Recipes" };

/**
 * Recipes are explicitly a future feature (spec §40 — not part of the MVP
 * MUST HAVE list in §39). Rather than fake it, this page says so honestly
 * and points at what exists today.
 */
export default function RecipesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Recipes</h1>
        <p className="text-muted-foreground text-sm">Multi-ingredient recipe logging.</p>
      </div>

      <Card className="mx-auto max-w-lg">
        <CardHeader className="items-center text-center">
          <div className="bg-muted mb-2 flex size-12 items-center justify-center rounded-full">
            <ChefHat className="size-6" aria-hidden />
          </div>
          <CardTitle>Coming in a future release</CardTitle>
          <CardDescription>
            Saved recipes with per-ingredient nutrition are planned but not part of the current
            version — we won&apos;t pretend otherwise. The database schema is already ready for
            them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">In the meantime you can:</p>
          <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
            <li>
              Create a <span className="text-foreground font-medium">custom food</span> for a
              whole dish (e.g. one bowl of your dal) with its combined nutrition.
            </li>
            <li>Log each ingredient separately from the food search.</li>
          </ul>
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            <Button size="sm" render={<Link href="/app/food" />}>
              Browse foods
            </Button>
            <Button size="sm" variant="outline" render={<Link href="/app/log?mode=manual" />}>
              Add a custom food
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
