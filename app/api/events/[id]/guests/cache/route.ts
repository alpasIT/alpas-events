import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/events/[id]/guests/cache
 * Returns a lightweight guest list for offline QR scanner caching.
 * Staff/admin only — exposes qrToken values used for check-in.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id: eventId } = await params;

  const guests = await prisma.guest.findMany({
    where: { eventId },
    select: {
      id: true,
      qrToken: true,
      fullName: true,
      salutation: true,
      company: true,
      category: true,
      attendanceStatus: true,
      plusOnes: { select: { id: true, name: true, checkedIn: true } },
    },
  });

  return NextResponse.json(guests, {
    headers: { "Cache-Control": "no-store" },
  });
}
