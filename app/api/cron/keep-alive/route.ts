import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Pings Postgres so Free-tier Supabase projects do not sit fully idle.
 * Supabase Free still pauses after ~1 week without activity; this reduces
 * that risk. It does NOT replace a Pro plan (only Pro+ guarantees no pause).
 *
 * Auth: Authorization: Bearer <CRON_SECRET>  OR  ?secret=<CRON_SECRET>
 * Schedule via Vercel Cron (vercel.json) or an external scheduler hitting this URL.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  // Vercel Cron sends this header when CRON_SECRET is set on the project
  const vercelAuth = request.headers.get("authorization");
  if (vercelAuth?.startsWith("Bearer ") && vercelAuth.slice(7) === secret) return true;

  const urlSecret = request.nextUrl.searchParams.get("secret");
  if (urlSecret && urlSecret === secret) return true;

  return false;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Lightweight round-trip against Postgres (Supabase)
    await prisma.$queryRaw`SELECT 1 AS ok`;
    // Touch a cheap metadata read so connection + query path stay warm
    const adminCount = await prisma.adminUser.count();

    return NextResponse.json({
      ok: true,
      service: "alpas-events-keep-alive",
      at: new Date().toISOString(),
      adminCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Keep-alive failed";
    console.error("[keep-alive]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
