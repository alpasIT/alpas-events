import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  if (!checkRateLimit(`check-in:${getClientIp(request)}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many requests, please try again shortly" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { token, eventId, plusOneId } = body as {
      token: string;
      eventId?: string;
      plusOneId?: string;
    };

    if (!token) return NextResponse.json({ error: "Token is required" }, { status: 400 });

    const guest = await prisma.guest.findFirst({
      where: { qrToken: token, ...(eventId ? { eventId } : {}) },
      include: { plusOnes: true },
    });

    if (!guest) return NextResponse.json({ error: "Invalid QR code" }, { status: 404 });

    const now = new Date();

    if (plusOneId) {
      // Check-in a specific plus-one by id
      const plusOne = guest.plusOnes.find((p) => p.id === plusOneId);
      if (!plusOne) {
        return NextResponse.json({ error: "Plus-one not found for this guest" }, { status: 404 });
      }
      if (plusOne.checkedIn) {
        return NextResponse.json(
          { error: `${plusOne.name} is already checked in`, alreadyCheckedIn: true },
          { status: 409 },
        );
      }
      await prisma.plusOne.update({
        where: { id: plusOneId },
        data: { checkedIn: true, checkedInAt: now },
      });
      await prisma.activityLog.create({
        data: {
          eventId: guest.eventId,
          type: "ATTENDANCE_MARKED",
          description: `${plusOne.name} (plus-one of ${guest.fullName}) checked in`,
          guestId: guest.id,
        },
      });
      return NextResponse.json({
        success: true,
        isPlusOne: true,
        guestName: plusOne.name,
        primaryGuestName: guest.fullName,
        category: guest.category,
      });
    }

    // Primary guest check-in
    const alreadyCheckedIn = guest.attendanceStatus === "CONFIRMED_PRESENT";

    await prisma.guest.update({
      where: { id: guest.id },
      data: {
        attendanceStatus: "CONFIRMED_PRESENT",
        attendanceMarkedAt: now,
      },
    });

    if (!alreadyCheckedIn) {
      await prisma.activityLog.create({
        data: {
          eventId: guest.eventId,
          type: "QR_SCANNED",
          description: `${guest.fullName} checked in via QR code`,
          guestId: guest.id,
        },
      });
    }

    return NextResponse.json({
      success: true,
      guestName: guest.fullName,
      category: guest.category,
      plusOnes: guest.plusOnes.map((p) => ({ id: p.id, name: p.name, checkedIn: p.checkedIn })),
      alreadyCheckedIn,
    });
  } catch {
    return NextResponse.json({ error: "Check-in failed" }, { status: 500 });
  }
}
