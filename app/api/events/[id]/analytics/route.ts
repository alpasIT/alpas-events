import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id: eventId } = await params;

  const [rsvpGroups, attendanceGroups, categoryGroups, guests, checkInTimeline] =
    await Promise.all([
      prisma.guest.groupBy({
        by: ["rsvpStatus"],
        where: { eventId },
        _count: true,
      }),
      prisma.guest.groupBy({
        by: ["attendanceStatus"],
        where: { eventId },
        _count: true,
      }),
      prisma.guest.groupBy({
        by: ["category"],
        where: { eventId },
        _count: true,
      }),
      prisma.guest.findMany({
        where: { eventId },
        select: { rsvpStatus: true, attendanceStatus: true, createdAt: true, category: true },
        orderBy: { createdAt: "asc" },
      }),
      // Check-ins per hour on event day
      prisma.guest.findMany({
        where: {
          eventId,
          attendanceStatus: { in: ["CONFIRMED_PRESENT", "WALK_IN_OVERRIDE", "UNREGISTERED_WALK_IN"] },
          attendanceMarkedAt: { not: null },
        },
        select: { attendanceMarkedAt: true },
        orderBy: { attendanceMarkedAt: "asc" },
      }),
    ]);

  // RSVP breakdown
  const rsvpBreakdown = ["ACCEPTED", "DECLINED", "PENDING", "SENT", "EXPIRED"].map((status) => ({
    status,
    count: rsvpGroups.find((g) => g.rsvpStatus === status)?._count ?? 0,
  }));

  // Attendance breakdown
  const attendanceBreakdown = [
    "CONFIRMED_PRESENT",
    "NOT_YET",
    "WALK_IN_OVERRIDE",
    "UNREGISTERED_WALK_IN",
    "NO_SHOW",
    "EXCUSED_ABSENCE",
  ].map((status) => ({
    status,
    label: status.replace(/_/g, " "),
    count: attendanceGroups.find((g) => g.attendanceStatus === status)?._count ?? 0,
  }));

  // Category breakdown
  const categoryBreakdown = ["GENERAL", "VIP", "MEDIA", "SPONSOR", "SPEAKER"].map((cat) => ({
    category: cat,
    total: categoryGroups.find((g) => g.category === cat)?._count ?? 0,
    accepted: guests.filter((g) => g.category === cat && g.rsvpStatus === "ACCEPTED").length,
    present: guests.filter(
      (g) =>
        g.category === cat &&
        ["CONFIRMED_PRESENT", "WALK_IN_OVERRIDE", "UNREGISTERED_WALK_IN"].includes(
          g.attendanceStatus,
        ),
    ).length,
  }));

  // Registration growth (cumulative guests added over time, binned by day)
  const dayMap: Record<string, number> = {};
  for (const g of guests) {
    const day = g.createdAt.toISOString().slice(0, 10);
    dayMap[day] = (dayMap[day] ?? 0) + 1;
  }
  let cumulative = 0;
  const registrationGrowth = Object.entries(dayMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => {
      cumulative += count;
      return { date, count, cumulative };
    });

  // Check-in timeline (binned by hour)
  const hourMap: Record<string, number> = {};
  for (const g of checkInTimeline) {
    if (!g.attendanceMarkedAt) continue;
    const hour = g.attendanceMarkedAt.toISOString().slice(0, 13); // "2025-05-01T14"
    hourMap[hour] = (hourMap[hour] ?? 0) + 1;
  }
  const checkInByHour = Object.entries(hourMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, count]) => ({
      hour: `${hour.slice(11)}:00`,
      count,
    }));

  // Summary stats
  const total = guests.length;
  const accepted = guests.filter((g) => g.rsvpStatus === "ACCEPTED").length;
  const present = guests.filter((g) =>
    ["CONFIRMED_PRESENT", "WALK_IN_OVERRIDE", "UNREGISTERED_WALK_IN"].includes(g.attendanceStatus),
  ).length;
  const noShow = guests.filter((g) => g.attendanceStatus === "NO_SHOW").length;

  return NextResponse.json({
    summary: {
      total,
      accepted,
      present,
      noShow,
      rsvpRate: total > 0 ? Math.round((accepted / total) * 100) : 0,
      attendanceRate: accepted > 0 ? Math.round((present / accepted) * 100) : 0,
      noShowRate: accepted > 0 ? Math.round((noShow / accepted) * 100) : 0,
    },
    rsvpBreakdown,
    attendanceBreakdown,
    categoryBreakdown,
    registrationGrowth,
    checkInByHour,
  });
}
