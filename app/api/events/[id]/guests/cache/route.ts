import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, STAFF_CHECK_IN_ROLES } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/events/[id]/guests/cache
 * Returns a lightweight guest list for offline QR scanner caching.
 * Only returns fields needed for check-in lookup (includes qrToken).
 * Restricted to staff check-in roles — not VIEWER.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAdmin(STAFF_CHECK_IN_ROLES);
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
