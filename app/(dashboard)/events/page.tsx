import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Plus, Calendar, MapPin, Users, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime } from "@/lib/utils";

export default async function EventsPage() {
  const events = await prisma.event.findMany({
    orderBy: { date: "desc" },
    include: {
      _count: { select: { guests: true } },
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Events</h1>
          <p className="text-muted-foreground text-sm">{events.length} total event(s)</p>
        </div>
        <Button asChild>
          <Link href="/events/new">
            <Plus className="h-4 w-4 mr-2" />
            New Event
          </Link>
        </Button>
      </div>

      {events.length === 0 ? (
        <div className="border-2 border-dashed rounded-lg p-12 text-center">
          <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="font-semibold mb-2">No events yet</h3>
          <p className="text-muted-foreground text-sm mb-4">Create your first event to get started</p>
          <Button asChild>
            <Link href="/events/new">Create Event</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {events.map((event) => {
            const now = new Date();
            const eventDate = new Date(event.date);
            const isUpcoming = eventDate > now;
            const isPast = eventDate < now;

            return (
              <Link key={event.id} href={`/events/${event.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-base leading-tight">{event.name}</h3>
                      <Badge variant={isUpcoming ? "default" : "secondary"} className="flex-shrink-0 text-xs">
                        {isUpcoming ? "Upcoming" : "Past"}
                      </Badge>
                    </div>

                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>{formatDate(event.date)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>{formatDateTime(event.startTime)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{event.venue}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>{event._count.guests} guest(s)</span>
                      </div>
                    </div>

                    <div className="pt-1 text-xs text-muted-foreground">
                      RSVP by: {formatDateTime(event.rsvpDeadline)}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
