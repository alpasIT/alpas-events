import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { guestSchema } from "@/lib/validations";

interface Params {
  params: Promise<{ id: string; guestId: string }>;
}

export async function GET(_: NextRequest, { params }: Params) {
  const { guestId } = await params;
  try {
    const guest = await prisma.guest.findUnique({ where: { id: guestId } });
    if (!guest) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(guest);
  } catch {
    return NextResponse.json({ error: "Failed to fetch guest" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id: eventId, guestId } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = await prisma.adminUser.findUnique({ where: { email: user.email! } });
    if (!admin) return NextResponse.json({ error: "Admin not found" }, { status: 403 });

    const body = await request.json();
    const parsed = guestSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const existing = await prisma.guest.findUnique({ where: { id: guestId } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { plusOneNames, ...guestData } = parsed.data;

    const guest = await prisma.guest.update({
      where: { id: guestId },
      data: {
        ...guestData,
        ...(plusOneNames !== undefined
          ? {
              plusOnes: {
                deleteMany: {},
                create: plusOneNames.map((name) => ({ name })),
              },
            }
          : {}),
      },
    });

    // Log field changes
    const changedFields = Object.keys(guestData) as (keyof typeof guestData)[];
    for (const field of changedFields) {
      const oldVal = String(existing[field as keyof typeof existing] ?? "");
      const newVal = String(parsed.data[field] ?? "");
      if (oldVal !== newVal) {
        await prisma.guestChangeHistory.create({
          data: {
            guestId,
            adminId: admin.id,
            fieldName: field,
            oldValue: oldVal,
            newValue: newVal,
          },
        });
      }
    }

    await prisma.activityLog.create({
      data: {
        eventId,
        type: "GUEST_UPDATED",
        description: `Guest ${guest.fullName} was updated`,
        guestId: guest.id,
        adminId: admin.id,
      },
    });

    return NextResponse.json(guest);
  } catch {
    return NextResponse.json({ error: "Failed to update guest" }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { guestId } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await prisma.guest.delete({ where: { id: guestId } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete guest" }, { status: 500 });
  }
}
