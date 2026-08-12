import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { EventNav } from "@/components/event-nav";
import { GuestsClient } from "@/components/guests-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function GuestsPage({ params }: PageProps) {
  const { id } = await params;

  const event = await prisma.event.findUnique({
    where: { id },
    select: { name: true, date: true, enablePlusOne: true, enableDietaryPreference: true },
  });
  if (!event) notFound();

  const guests = await prisma.guest.findMany({
    where: { eventId: id },
    orderBy: { createdAt: "desc" },
  });

  const serialized = guests.map((g) => ({
    ...g,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
    rsvpRespondedAt: g.rsvpRespondedAt?.toISOString() ?? null,
    attendanceMarkedAt: g.attendanceMarkedAt?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-0">
      <EventNav eventId={id} />
      <div className="p-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold">Guests</h1>
          <p className="text-sm text-muted-foreground">{event.name}</p>
        </div>
        <GuestsClient
          eventId={id}
          initialGuests={serialized}
          enablePlusOne={event.enablePlusOne}
          enableDietaryPreference={event.enableDietaryPreference}
          eventDate={event.date.toISOString()}
        />
      </div>
    </div>
  );
}
