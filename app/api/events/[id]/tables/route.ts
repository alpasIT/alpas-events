import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id: eventId } = await params;

  const tables = await prisma.seatingTable.findMany({
    where: { eventId },
    orderBy: { label: "asc" },
    include: {
      seats: {
        include: {
          guest: {
            select: {
              id: true,
              fullName: true,
              salutation: true,
              company: true,
              category: true,
              attendanceStatus: true,
              seatId: true,
            },
          },
        },
      },
    },
  });

  return NextResponse.json(tables);
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id: eventId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { label, capacity } = body as { label: string; capacity: number };

  if (!label?.trim()) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }
  if (!capacity || capacity < 1) {
    return NextResponse.json({ error: "capacity must be at least 1" }, { status: 400 });
  }

  const table = await prisma.seatingTable.create({
    data: { eventId, label: label.trim(), capacity },
    include: { seats: true },
  });

  return NextResponse.json(table, { status: 201 });
}
