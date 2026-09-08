import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

interface Params {
  params: Promise<{ id: string; tableId: string }>;
}

/**
 * POST /api/events/[id]/tables/[tableId]/assign
 * Body: { guestId }  — assigns a guest to this table (creates a Seat if needed).
 * Pass tableId = "unassign" to remove guest from any table.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAdmin(["SUPER_ADMIN", "EVENT_COORDINATOR", "STAFF"]);
  if (auth.response) return auth.response;

  const { tableId } = await params;

  const body = await request.json();
  const { guestId } = body as { guestId: string };

  if (!guestId) return NextResponse.json({ error: "guestId is required" }, { status: 400 });

  const guest = await prisma.guest.findUnique({ where: { id: guestId } });
  if (!guest) return NextResponse.json({ error: "Guest not found" }, { status: 404 });

  // Remove current seat assignment (if any)
  if (guest.seatId) {
    await prisma.seat.delete({ where: { id: guest.seatId } });
  }

  if (tableId === "unassign") {
    // Already cleared above — just return
    return NextResponse.json({ success: true });
  }

  const table = await prisma.seatingTable.findUnique({
    where: { id: tableId },
    include: { seats: true },
  });
  if (!table) return NextResponse.json({ error: "Table not found" }, { status: 404 });

  const occupiedSeats = table.seats.length;
  if (occupiedSeats >= table.capacity) {
    return NextResponse.json(
      { error: `Table "${table.label}" is full (capacity: ${table.capacity})` },
      { status: 409 }
    );
  }

  // Create a new seat and link the guest
  const seat = await prisma.seat.create({
    data: {
      tableId,
      seatNumber: occupiedSeats + 1,
      assignedAt: new Date(),
    },
  });

  await prisma.guest.update({
    where: { id: guestId },
    data: { seatId: seat.id },
  });

  return NextResponse.json({ success: true, seatId: seat.id });
}
