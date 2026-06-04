import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { EventNav } from "@/components/event-nav";
import { SeatingClientWrapper } from "@/components/seating-client-wrapper";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SeatingPage({ params }: PageProps) {
  const { id } = await params;

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) notFound();

  const [tables, guests] = await Promise.all([
    prisma.seatingTable.findMany({
      where: { eventId: id },
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
    }),
    prisma.guest.findMany({
      where: {
        eventId: id,
        OR: [
          { rsvpStatus: "ACCEPTED" },
          { attendanceStatus: { in: ["CONFIRMED_PRESENT", "WALK_IN_OVERRIDE", "UNREGISTERED_WALK_IN"] } },
        ],
      },
      orderBy: { fullName: "asc" },
      select: {
        id: true,
        fullName: true,
        salutation: true,
        company: true,
        category: true,
        attendanceStatus: true,
        seatId: true,
      },
    }),
  ]);

  const totalSeats = tables.reduce((acc, t) => acc + t.capacity, 0);
  const assignedCount = guests.filter((g) => g.seatId !== null).length;

  return (
    <div className="space-y-0">
      <EventNav eventId={id} />
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-bold">Seating Arrangement</h1>
            <p className="text-sm text-muted-foreground">{event.name}</p>
          </div>
          <div className="flex gap-4 text-sm text-center">
            <div className="border rounded-lg px-4 py-2">
              <p className="text-lg font-bold">{tables.length}</p>
              <p className="text-muted-foreground text-xs">Tables</p>
            </div>
            <div className="border rounded-lg px-4 py-2">
              <p className="text-lg font-bold">{assignedCount} / {guests.length}</p>
              <p className="text-muted-foreground text-xs">Assigned</p>
            </div>
            <div className="border rounded-lg px-4 py-2">
              <p className="text-lg font-bold">{totalSeats - assignedCount}</p>
              <p className="text-muted-foreground text-xs">Open Seats</p>
            </div>
          </div>
        </div>

        <SeatingClientWrapper
          eventId={id}
          initialTables={JSON.parse(JSON.stringify(tables))}
          initialGuests={JSON.parse(JSON.stringify(guests))}
        />
      </div>
    </div>
  );
}
