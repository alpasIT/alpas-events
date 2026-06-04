import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { EventNav } from "@/components/event-nav";
import { AnalyticsClient } from "@/components/analytics-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AnalyticsPage({ params }: PageProps) {
  const { id } = await params;

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) notFound();

  return (
    <div className="space-y-0">
      <EventNav eventId={id} />
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold">Analytics</h1>
          <p className="text-sm text-muted-foreground">{event.name}</p>
        </div>
        <AnalyticsClient eventId={id} />
      </div>
    </div>
  );
}
