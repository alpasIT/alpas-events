import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { eventSchema } from "@/lib/validations";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  try {
    const event = await prisma.event.findUnique({
      where: { id },
      include: { _count: { select: { guests: true, invitations: true } } },
    });
    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(event);
  } catch {
    return NextResponse.json({ error: "Failed to fetch event" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  try {
    const existing = await prisma.event.findUnique({ where: { id }, select: { createdById: true } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const canEdit = auth.admin.role === "SUPER_ADMIN" || existing.createdById === auth.admin.id;
    if (!canEdit) return NextResponse.json({ error: "Only the event creator or a Super Admin can edit event details" }, { status: 403 });
    const body = await request.json();
    const parsed = eventSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const { date, startTime, endTime, rsvpDeadline, ...rest } = parsed.data;

    const event = await prisma.event.update({
      where: { id },
      data: {
        ...rest,
        ...(date && { date: new Date(date) }),
        ...(startTime && { startTime: new Date(startTime) }),
        ...(endTime !== undefined && { endTime: endTime ? new Date(endTime) : null }),
        ...(rsvpDeadline && { rsvpDeadline: new Date(rsvpDeadline) }),
      },
    });

    return NextResponse.json(event);
  } catch {
    return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const auth = await requireAdmin(["SUPER_ADMIN", "EVENT_COORDINATOR"]);
  if (auth.response) return auth.response;

  const { id } = await params;
  try {
    await prisma.event.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
  }
}
