"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Mail, CheckSquare, FileText, LayoutDashboard, Settings, LayoutGrid, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface EventNavProps {
  eventId: string;
}

export function EventNav({ eventId }: EventNavProps) {
  const pathname = usePathname();

  const tabs = [
    { href: `/events/${eventId}`, label: "Overview", icon: LayoutDashboard, exact: true },
    { href: `/events/${eventId}/guests`, label: "Guests", icon: Users },
    { href: `/events/${eventId}/invitations`, label: "Invitations", icon: Mail },
    { href: `/events/${eventId}/attendance`, label: "Attendance", icon: CheckSquare },
    { href: `/events/${eventId}/templates`, label: "Templates", icon: FileText },
    { href: `/events/${eventId}/seating`, label: "Seating", icon: LayoutGrid },
    { href: `/events/${eventId}/analytics`, label: "Analytics", icon: BarChart2 },
    { href: `/events/${eventId}/settings`, label: "Settings", icon: Settings },
  ];

  return (
    <nav className="flex border-b overflow-x-auto">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors",
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
