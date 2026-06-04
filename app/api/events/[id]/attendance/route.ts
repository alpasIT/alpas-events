import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id: eventId } = await params;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = await prisma.adminUser.findUnique({ where: { email: user.email! } });
    if (!admin) return NextResponse.json({ error: "Admin not found" }, { status: 403 });

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
        adminId: admin.id,
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
        adminId: admin.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to update attendance" }, { status: 500 });
  }
}
