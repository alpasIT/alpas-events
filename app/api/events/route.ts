import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { eventSchema } from "@/lib/validations";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const events = await prisma.event.findMany({
      orderBy: { date: "desc" },
      include: { _count: { select: { guests: true, invitations: true } } },
    });
    return NextResponse.json(events);
  } catch {
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const body = await request.json();
    const parsed = eventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const { date, startTime, endTime, rsvpDeadline, ...rest } = parsed.data;

    const event = await prisma.event.create({
      data: {
        ...rest,
        date: new Date(date),
        startTime: new Date(startTime),
        endTime: endTime ? new Date(endTime) : null,
        rsvpDeadline: new Date(rsvpDeadline),
      },
    });

    return NextResponse.json(event, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}
