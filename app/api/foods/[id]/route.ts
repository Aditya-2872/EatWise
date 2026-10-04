import { NextResponse, type NextRequest } from "next/server";

import { getUserContext } from "@/lib/auth/session";
import { canAccessFood, getFoodById } from "@/lib/foods/repository";

export const dynamic = "force-dynamic";

/**
 * GET /api/foods/:id — full food detail. Private (user/ai) foods are only
 * returned to their owner; everything else is a 404 (no existence leak).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid food id." }, { status: 400 });
  }

  try {
    const row = await getFoodById(ctx.supabase, id);
    if (!row || !canAccessFood(row, ctx.userId)) {
      return NextResponse.json({ error: "Food not found." }, { status: 404 });
    }
    return NextResponse.json({ food: row });
  } catch (err) {
    console.error("[api/foods/:id]", err);
    return NextResponse.json({ error: "Could not load the food." }, { status: 500 });
  }
}
