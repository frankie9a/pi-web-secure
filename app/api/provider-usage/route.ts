import { NextResponse } from "next/server";
import { queryOpenCodeGoUsage } from "@/lib/provider-usage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/provider-usage - OpenCode Go window usage for the Models panel.
export async function GET() {
  const result = await queryOpenCodeGoUsage();
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
