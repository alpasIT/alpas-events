import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { EventNav } from "@/components/event-nav";
import { AttendanceClient } from "@/components/attendance-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AttendancePage({ params }: PageProps) {
  const { id } = await params;

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) notFound();

  const guests = await prisma.guest.findMany({
    where: { eventId: id },
    orderBy: [{ attendanceStatus: "asc" }, { fullName: "asc" }],
    select: {
      id: true,
      fullName: true,
      email: true,
      company: true,
      designation: true,
      category: true,
      rsvpStatus: true,
      attendanceStatus: true,
      attendanceMarkedAt: true,
      salutation: true,
      plusOnes: { select: { id: true, name: true, checkedIn: true } },
    },
  });

  const serialized = guests.map((g) => ({
    ...g,
    attendanceMarkedAt: g.attendanceMarkedAt?.toISOString() ?? null,
  }));

  // Stats
  const checkedIn = guests.filter((g) => g.attendanceStatus === "CONFIRMED_PRESENT").length;
  const walkIns = guests.filter((g) =>
    g.attendanceStatus === "WALK_IN_OVERRIDE" || g.attendanceStatus === "UNREGISTERED_WALK_IN"
  ).length;
  const noShow = guests.filter((g) => g.attendanceStatus === "NO_SHOW").length;

  return (
    <div className="space-y-0">
      <EventNav eventId={id} />
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold">Attendance</h1>
          <p className="text-sm text-muted-foreground">{event.name}</p>
        </div>

        <div className="grid grid-cols-3 gap-4 max-w-md">
          <div className="border rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{checkedIn}</p>
            <p className="text-xs text-muted-foreground">Checked In</p>
          </div>
          <div className="border rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-orange-600">{walkIns}</p>
            <p className="text-xs text-muted-foreground">Walk-ins</p>
          </div>
          <div className="border rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{noShow}</p>
            <p className="text-xs text-muted-foreground">No-shows</p>
          </div>
        </div>

        <AttendanceClient eventId={id} initialGuests={serialized} />
      </div>
    </div>
  );
}
