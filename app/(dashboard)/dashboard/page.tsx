import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Users, CheckSquare, Mail, TrendingUp, CalendarDays, Plus } from "lucide-react";
import { StatsCard } from "@/components/stats-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatTimeAgo, getRsvpStatusColor } from "@/lib/utils";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const events = await prisma.event.findMany({
    orderBy: { date: "desc" },
    include: {
      _count: {
        select: {
          guests: true,
          invitations: true,
        },
      },
    },
  });

  // Aggregate stats across all events
  const [totalGuests, rsvpCounts, attendanceCounts, recentActivity] = await Promise.all([
    prisma.guest.count(),
    prisma.guest.groupBy({ by: ["rsvpStatus"], _count: true }),
    prisma.guest.groupBy({ by: ["attendanceStatus"], _count: true }),
    prisma.activityLog.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        guest: { select: { fullName: true } },
        event: { select: { name: true } },
      },
    }),
  ]);

  const accepted = rsvpCounts.find((r) => r.rsvpStatus === "ACCEPTED")?._count ?? 0;
  const declined = rsvpCounts.find((r) => r.rsvpStatus === "DECLINED")?._count ?? 0;
  const checkedIn = attendanceCounts.find((a) => a.attendanceStatus === "CONFIRMED_PRESENT")?._count ?? 0;

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

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Guests" value={totalGuests} icon={Users} iconColor="text-blue-600" />
        <StatsCard title="RSVP Accepted" value={accepted} icon={TrendingUp} iconColor="text-green-600" />
        <StatsCard title="RSVP Declined" value={declined} icon={Mail} iconColor="text-red-600" />
        <StatsCard title="Checked In" value={checkedIn} icon={CheckSquare} iconColor="text-purple-600" />
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
              events.slice(0, 5).map((event) => (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div>
                    <p className="font-medium text-sm">{event.name}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(event.date)} · {event.venue}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{event._count.guests}</p>
                    <p className="text-xs text-muted-foreground">guests</p>
                  </div>
                </Link>
              ))
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
                      <span className="text-xs text-muted-foreground">{formatTimeAgo(log.createdAt)}</span>
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
