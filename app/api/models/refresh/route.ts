import { NextResponse } from "next/server";
import { refreshModelCatalog } from "@/lib/model-catalog-refresh";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

// POST /api/models/refresh - revalidate the pi.dev catalog overlay so models a
// provider shipped after this app's pinned SDK version become visible.
// body: { providers?: string[] } - omitted refreshes every provider.
export async function POST(req: Request) {
  let providers: string[] | undefined;
  try {
    const body = await req.json() as { providers?: unknown } | null;
    if (Array.isArray(body?.providers)) {
      const ids = body.providers.filter((id): id is string => typeof id === "string" && id.trim() !== "");
      if (ids.length > 0) providers = ids;
    }
  } catch {
    // An empty or absent body means "refresh everything".
  }

  try {
    const result = await refreshModelCatalog(providers);
    return NextResponse.json(
      { success: true, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
