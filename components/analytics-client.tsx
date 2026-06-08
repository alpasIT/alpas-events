"use client";

import { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckSquare, TrendingUp, XCircle } from "lucide-react";

interface Summary {
  total: number;
  accepted: number;
  present: number;
  noShow: number;
  rsvpRate: number;
  attendanceRate: number;
  noShowRate: number;
}

interface AnalyticsData {
  summary: Summary;
  rsvpBreakdown: { status: string; count: number }[];
  attendanceBreakdown: { status: string; label: string; count: number }[];
  categoryBreakdown: { category: string; total: number; accepted: number; present: number }[];
  registrationGrowth: { date: string; count: number; cumulative: number }[];
  checkInByHour: { hour: string; count: number }[];
}

const RSVP_COLORS: Record<string, string> = {
  ACCEPTED: "#22c55e",
  DECLINED: "#ef4444",
  PENDING: "#eab308",
  SENT: "#3b82f6",
  EXPIRED: "#9ca3af",
};

const ATTENDANCE_COLORS: Record<string, string> = {
  "CONFIRMED PRESENT": "#22c55e",
  "NOT YET": "#9ca3af",
  "WALK IN OVERRIDE": "#a855f7",
  "UNREGISTERED WALK IN": "#f97316",
  "NO SHOW": "#ef4444",
  "EXCUSED ABSENCE": "#3b82f6",
};

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AnalyticsClient({ eventId }: { eventId: string }) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/events/${eventId}/analytics`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [eventId]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}><CardContent className="p-5 h-24 animate-pulse bg-muted/40 rounded-lg" /></Card>
        ))}
      </div>
    );
  }

  if (!data) return <p className="text-muted-foreground">Failed to load analytics.</p>;

  const { summary, rsvpBreakdown, attendanceBreakdown, categoryBreakdown, registrationGrowth, checkInByHour } = data;

  const rsvpPieData = rsvpBreakdown.filter((d) => d.count > 0);
  const attendancePieData = attendanceBreakdown.filter((d) => d.count > 0);

  return (
    <div className="space-y-6">
      {/* ── Summary stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Guests" value={summary.total} icon={Users} color="bg-blue-100 text-blue-700" />
        <StatCard label="RSVP Rate" value={`${summary.rsvpRate}%`} sub={`${summary.accepted} accepted`} icon={TrendingUp} color="bg-green-100 text-green-700" />
        <StatCard label="Attendance Rate" value={`${summary.attendanceRate}%`} sub={`${summary.present} checked in`} icon={CheckSquare} color="bg-purple-100 text-purple-700" />
        <StatCard label="No-Show Rate" value={`${summary.noShowRate}%`} sub={`${summary.noShow} no-shows`} icon={XCircle} color="bg-red-100 text-red-700" />
      </div>

      {/* ── RSVP & Attendance pie charts ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">RSVP Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={rsvpPieData} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : '0'}%`} labelLine={false}>
                  {rsvpPieData.map((entry) => (
                    <Cell key={entry.status} fill={RSVP_COLORS[entry.status] ?? "#9ca3af"} />
                  ))}
                </Pie>
                <Tooltip formatter={(val, name) => [val, name]} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Attendance Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={attendancePieData} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${percent ? (percent * 100).toFixed(0) : '0'}%`} labelLine={false}>
                  {attendancePieData.map((entry) => (
                    <Cell key={entry.status} fill={ATTENDANCE_COLORS[entry.label] ?? "#9ca3af"} />
                  ))}
                </Pie>
                <Tooltip formatter={(val, name) => [val, name]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── Category breakdown ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">By Guest Category</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={categoryBreakdown} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="category" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" name="Total" fill="#93c5fd" radius={[4, 4, 0, 0]} />
              <Bar dataKey="accepted" name="Accepted" fill="#4ade80" radius={[4, 4, 0, 0]} />
              <Bar dataKey="present" name="Present" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── Registration growth ── */}
      {registrationGrowth.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Guest Registration Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={registrationGrowth} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="cumulative" name="Total Guests" stroke="#6366f1" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="count" name="Added Per Day" stroke="#a5b4fc" strokeWidth={1} dot={false} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ── Check-in timeline ── */}
      {checkInByHour.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Check-in Timeline (by Hour)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={checkInByHour} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" name="Check-ins" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
