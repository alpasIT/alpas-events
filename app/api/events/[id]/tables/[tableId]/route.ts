import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ id: string; tableId: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { tableId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { label, capacity } = body as { label?: string; capacity?: number };

  const table = await prisma.seatingTable.update({
    where: { id: tableId },
    data: {
      ...(label?.trim() ? { label: label.trim() } : {}),
      ...(capacity && capacity >= 1 ? { capacity } : {}),
    },
    include: { seats: true },
  });

  return NextResponse.json(table);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { tableId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Deleting the table cascades to seats; Guest.seatId becomes null via SetNull
  await prisma.seatingTable.delete({ where: { id: tableId } });

  return NextResponse.json({ success: true });
}

// POST /api/events/[id]/tables/[tableId]/assign handled separately
