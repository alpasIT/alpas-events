import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { EventNav } from "@/components/event-nav";
import { InvitationsClient } from "@/components/invitations-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function InvitationsPage({ params }: PageProps) {
  const { id } = await params;

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) notFound();

  const invitations = await prisma.invitation.findMany({
    where: { eventId: id },
    orderBy: { createdAt: "desc" },
    include: {
      guest: {
        select: { fullName: true, email: true, category: true },
      },
    },
  });

  const serialized = invitations.map((inv) => ({
    ...inv,
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
    sentAt: inv.sentAt?.toISOString() ?? null,
    openedAt: inv.openedAt?.toISOString() ?? null,
    clickedAt: inv.clickedAt?.toISOString() ?? null,
    deliveredAt: inv.deliveredAt?.toISOString() ?? null,
    failedAt: inv.failedAt?.toISOString() ?? null,
    lastResentAt: inv.lastResentAt?.toISOString() ?? null,
    tokenExpiresAt: inv.tokenExpiresAt?.toISOString() ?? null,
    scheduledAt: inv.scheduledAt?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-0">
      <EventNav eventId={id} />
      <div className="p-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold">Invitations</h1>
          <p className="text-sm text-muted-foreground">{event.name}</p>
        </div>
        <InvitationsClient eventId={id} initialInvitations={serialized} eventDate={event.date.toISOString()} />
      </div>
    </div>
  );
}
