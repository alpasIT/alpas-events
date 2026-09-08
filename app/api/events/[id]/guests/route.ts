import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { guestSchema } from "@/lib/validations";
import { generateToken } from "@/lib/utils";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  try {
    const guests = await prisma.guest.findMany({
      where: { eventId: id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(guests);
  } catch {
    return NextResponse.json({ error: "Failed to fetch guests" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAdmin(["SUPER_ADMIN", "EVENT_COORDINATOR"]);
  if (auth.response) return auth.response;

  const { id: eventId } = await params;
  try {
    const body = await request.json();
    const parsed = guestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const qrToken = generateToken(24);
    const { plusOneNames, ...guestData } = parsed.data;

    const guest = await prisma.guest.create({
      data: {
        ...guestData,
        eventId,
        qrToken,
        ...(plusOneNames && plusOneNames.length > 0
          ? { plusOnes: { create: plusOneNames.map((name) => ({ name })) } }
          : {}),
      },
    });

    await prisma.activityLog.create({
      data: {
        eventId,
        type: "GUEST_CREATED",
        description: `Guest ${guest.fullName} was added`,
        guestId: guest.id,
        adminId: auth.admin.id,
      },
    });

    return NextResponse.json(guest, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create guest";
    if (message.includes("Unique constraint")) {
      return NextResponse.json({ error: "A guest with this email already exists for this event" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create guest" }, { status: 500 });
  }
}
