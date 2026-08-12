import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { notFound } from "next/navigation";
import { SettingsClient } from "@/components/settings-client";
import { EventNav } from "@/components/event-nav";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EventSettingsPage({ params }: PageProps) {
  const { id } = await params;

  const [event, admin] = await Promise.all([
    prisma.event.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        venue: true,
        date: true,
        startTime: true,
        endTime: true,
        createdById: true,
        enablePlusOne: true,
        enableDietaryPreference: true,
      },
    }),
    getCurrentAdmin(),
  ]);

  if (!event) notFound();

  const canEdit =
    admin?.role === "SUPER_ADMIN" ||
    (event.createdById !== null && event.createdById === admin?.id);

  return (
    <div>
      <EventNav eventId={id} />
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold">Event Settings</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure options for this event.
          </p>
        </div>
        <SettingsClient
          eventId={event.id}
          canEdit={canEdit}
          eventName={event.name}
          eventVenue={event.venue}
          eventDate={event.date.toISOString().split("T")[0]}
          eventStartTime={event.startTime.toISOString().slice(0, 16)}
          eventEndTime={event.endTime ? event.endTime.toISOString().slice(0, 16) : ""}
          initialEnablePlusOne={event.enablePlusOne}
          initialEnableDietaryPreference={event.enableDietaryPreference}
        />
      </div>
    </div>
  );
}
