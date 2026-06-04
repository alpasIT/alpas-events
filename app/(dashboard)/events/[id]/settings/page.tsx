import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { SettingsClient } from "@/components/settings-client";
import { EventNav } from "@/components/event-nav";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EventSettingsPage({ params }: PageProps) {
  const { id } = await params;

  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, enablePlusOne: true, enableDietaryPreference: true },
  });

  if (!event) notFound();

  return (
    <div>
      <EventNav eventId={id} />
      <div className="p-6">
        <div className="mb-6">
        <h2 className="text-xl font-semibold">Event Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure options for this event's RSVP experience.
        </p>
      </div>
      <SettingsClient
        eventId={event.id}
        initialEnablePlusOne={event.enablePlusOne}
        initialEnableDietaryPreference={event.enableDietaryPreference}
      />
      </div>
    </div>
  );
}
