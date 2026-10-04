import { NextResponse, type NextRequest } from "next/server";

import { getUserContext } from "@/lib/auth/session";
import { lookupBarcode } from "@/lib/foods/service";
import { rateLimit } from "@/lib/rate-limit";
import { barcodeSchema } from "@/lib/validation/logging";

export const dynamic = "force-dynamic";

/**
 * GET /api/products/barcode/:barcode — spec §13.4 path.
 * Internal cache first, then Open Food Facts; found products are cached
 * into food_items before returning.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ barcode: string }> },
) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(`barcode:${ctx.userId}`, { limit: 20, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many barcode lookups. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const { barcode } = await params;
  const parsed = barcodeSchema.safeParse(barcode);
  if (!parsed.success) {
    return NextResponse.json({ error: "Barcode must be 6–14 digits." }, { status: 400 });
  }

  try {
    const food = await lookupBarcode(parsed.data);
    if (!food) {
      return NextResponse.json(
        { error: "No product found for this barcode.", food: null },
        { status: 404 },
      );
    }
    return NextResponse.json({ food });
  } catch (err) {
    console.error("[api/products/barcode]", err);
    return NextResponse.json(
      { error: "Barcode lookup is unavailable right now." },
      { status: 503 },
    );
  }
}
