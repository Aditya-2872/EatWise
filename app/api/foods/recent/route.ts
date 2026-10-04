import { NextResponse } from "next/server";

import { getUserContext } from "@/lib/auth/session";
import { recentFoods } from "@/lib/foods/repository";

export const dynamic = "force-dynamic";

/**
 * GET /api/foods/recent
 * Personal food memory: recent & frequent foods for the Log quick list.
 */
export async function GET() {
  const ctx = await getUserContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const foods = await recentFoods(ctx.supabase, ctx.userId, 10);
  return NextResponse.json({ foods });
}
