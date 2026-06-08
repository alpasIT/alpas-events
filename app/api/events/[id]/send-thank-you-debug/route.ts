import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_: NextRequest, { params }: Params) {
  const { id: eventId } = await params;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = await prisma.adminUser.findUnique({ where: { email: user.email! } });
    if (!admin) return NextResponse.json({ error: "Admin not found" }, { status: 403 });

    // Get event
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    // Get attendees with CONFIRMED_PRESENT status
    const confirmed = await prisma.guest.findMany({
      where: {
        eventId,
        attendanceStatus: "CONFIRMED_PRESENT",
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        attendanceStatus: true,
      },
    });

    // Get all guest statuses for reference
    const allStatuses = await prisma.guest.groupBy({
      by: ["attendanceStatus"],
      where: { eventId },
      _count: true,
    });

    // Check for THANK_YOU template
    const thankYouTemplate = await prisma.emailTemplate.findFirst({
      where: {
        eventId,
        type: "THANK_YOU",
      },
      select: {
        id: true,
        name: true,
        type: true,
        subject: true,
      },
    });

    // Check environment variables
    const envOk = {
      RESEND_API_KEY: !!process.env.RESEND_API_KEY,
      EMAIL_FROM: !!process.env.EMAIL_FROM,
      NEXT_PUBLIC_APP_URL: !!process.env.NEXT_PUBLIC_APP_URL,
    };

    return NextResponse.json({
      eventId,
      event: { name: event.name, id: event.id },
      confirmed: {
        count: confirmed.length,
        guests: confirmed,
      },
      allStatuses: Object.fromEntries(
        allStatuses.map((s) => [s.attendanceStatus, s._count])
      ),
      template: thankYouTemplate,
      environment: envOk,
    });
  } catch (err) {
    console.error("Error in debug endpoint:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
