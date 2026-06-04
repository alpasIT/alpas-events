import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { EventNav } from "@/components/event-nav";
import { TemplatesClient } from "@/components/templates-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TemplatesPage({ params }: PageProps) {
  const { id } = await params;

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) notFound();

  const templates = await prisma.emailTemplate.findMany({
    where: { eventId: id },
    orderBy: { createdAt: "desc" },
  });

  const serialized = templates.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  return (
    <div className="space-y-0">
      <EventNav eventId={id} />
      <div className="p-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold">Email Templates</h1>
          <p className="text-sm text-muted-foreground">{event.name}</p>
        </div>
        <TemplatesClient eventId={id} initialTemplates={serialized} />
      </div>
    </div>
  );
}
