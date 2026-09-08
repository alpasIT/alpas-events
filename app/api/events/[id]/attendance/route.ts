import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, STAFF_CHECK_IN_ROLES } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAdmin(STAFF_CHECK_IN_ROLES);
  if (auth.response) return auth.response;
  const admin = auth.admin;

  const { id: eventId } = await params;

  try {
    const body = await request.json();
    const { guestId, status, staffNote, reason } = body as {
      guestId: string;
      status: string;
      staffNote?: string;
      reason?: string;
    };

    if (!guestId || !status) {
      return NextResponse.json({ error: "guestId and status are required" }, { status: 400 });
    }

    const validStatuses = [
      "NOT_YET",
      "CONFIRMED_PRESENT",
      "WALK_IN_OVERRIDE",
      "UNREGISTERED_WALK_IN",
      "NO_SHOW",
      "EXCUSED_ABSENCE",
    ];

    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid attendance status" }, { status: 400 });
    }

    const guest = await prisma.guest.findUnique({ where: { id: guestId } });
    if (!guest) return NextResponse.json({ error: "Guest not found" }, { status: 404 });

    const fromStatus = guest.attendanceStatus;
    const now = new Date();

    await prisma.guest.update({
      where: { id: guestId },
      data: {
        attendanceStatus: status as never,
        attendanceMarkedAt: now,
      },
    });

    await prisma.attendanceOverride.create({
      data: {
        guestId,
        adminId: auth.admin.id,
        fromStatus: fromStatus as never,
        toStatus: status as never,
        staffNote,
        reason,
      },
    });

    await prisma.activityLog.create({
      data: {
        eventId,
        type: "ATTENDANCE_MARKED",
        description: `${guest.fullName} marked as ${status.replace(/_/g, " ")}`,
        guestId,
        adminId: auth.admin.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to update attendance" }, { status: 500 });
  }
}
