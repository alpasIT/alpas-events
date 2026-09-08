import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatTimeAgo } from "@/lib/utils";

type EventStats = {
  total: number;
  accepted: number;
  declined: number;
  checkedIn: number;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const events = await prisma.event.findMany({
    orderBy: { date: "desc" },
    take: 10,
    include: {
      _count: {
        select: {
          guests: true,
        },
      },
    },
  });

  const eventIds = events.map((event) => event.id);

  const [rsvpCounts, attendanceCounts, recentActivity] = await Promise.all([
    eventIds.length
      ? prisma.guest.groupBy({
          by: ["eventId", "rsvpStatus"],
          where: { eventId: { in: eventIds } },
          _count: true,
        })
      : Promise.resolve([]),
    eventIds.length
      ? prisma.guest.groupBy({
          by: ["eventId", "attendanceStatus"],
          where: { eventId: { in: eventIds } },
          _count: true,
        })
      : Promise.resolve([]),
    prisma.activityLog.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        guest: true,
        event: { select: { name: true } },
      },
    }),
  ]);

  const statsByEvent = new Map<string, EventStats>();

  for (const event of events) {
    statsByEvent.set(event.id, {
      total: event._count.guests,
      accepted: 0,
      declined: 0,
      checkedIn: 0,
    });
  }

  for (const row of rsvpCounts) {
    const stats = statsByEvent.get(row.eventId);
    if (!stats) continue;
    if (row.rsvpStatus === "ACCEPTED") stats.accepted = row._count;
    if (row.rsvpStatus === "DECLINED") stats.declined = row._count;
  }

  for (const row of attendanceCounts) {
    const stats = statsByEvent.get(row.eventId);
    if (!stats) continue;
    if (row.attendanceStatus === "CONFIRMED_PRESENT") {
      stats.checkedIn = row._count;
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Overview of all events</p>
        </div>
        <Button asChild>
          <Link href="/events/new">
            <Plus className="h-4 w-4 mr-2" />
            New Event
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Events List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Events</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/events">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {events.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No events yet</p>
                <Button variant="outline" size="sm" className="mt-3" asChild>
                  <Link href="/events/new">Create your first event</Link>
                </Button>
              </div>
            ) : (
              events.map((event) => {
                const stats = statsByEvent.get(event.id) ?? {
                  total: 0,
                  accepted: 0,
                  declined: 0,
                  checkedIn: 0,
                };

                return (
                  <Link
                    key={event.id}
                    href={`/events/${event.id}`}
                    className="block p-3 rounded-lg border hover:bg-accent transition-colors"
                  >
                    <div>
                      <p className="font-medium text-sm">{event.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(event.date)} · {event.venue}
                      </p>
                    </div>
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Total guests</p>
                        <p className="text-sm font-semibold">{stats.total}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">RSVP accepted</p>
                        <p className="text-sm font-semibold text-green-600">{stats.accepted}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">RSVP declined</p>
                        <p className="text-sm font-semibold text-red-600">{stats.declined}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Checked in</p>
                        <p className="text-sm font-semibold text-purple-600">{stats.checkedIn}</p>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No recent activity</p>
            ) : (
              recentActivity.map((log) => (
                <div key={log.id} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{log.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{log.event.name}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">
                        {formatTimeAgo(log.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
