import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "MMM d, yyyy");
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "MMM d, yyyy h:mm a");
}

export function formatTimeAgo(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function generateToken(length = 32): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

export function getRsvpStatusColor(status: string): string {
  const map: Record<string, string> = {
    ACCEPTED: "bg-green-100 text-green-800",
    DECLINED: "bg-red-100 text-red-800",
    PENDING: "bg-yellow-100 text-yellow-800",
    SENT: "bg-blue-100 text-blue-800",
    EXPIRED: "bg-gray-100 text-gray-800",
  };
  return map[status] ?? "bg-gray-100 text-gray-800";
}

export function getAttendanceStatusColor(status: string): string {
  const map: Record<string, string> = {
    CONFIRMED_PRESENT: "bg-green-100 text-green-800",
    NOT_YET: "bg-gray-100 text-gray-800",
    WALK_IN_OVERRIDE: "bg-purple-100 text-purple-800",
    UNREGISTERED_WALK_IN: "bg-orange-100 text-orange-800",
    NO_SHOW: "bg-red-100 text-red-800",
    EXCUSED_ABSENCE: "bg-blue-100 text-blue-800",
  };
  return map[status] ?? "bg-gray-100 text-gray-800";
}

export function getCategoryColor(category: string): string {
  const map: Record<string, string> = {
    VIP: "bg-yellow-100 text-yellow-800",
    MEDIA: "bg-blue-100 text-blue-800",
    SPONSOR: "bg-purple-100 text-purple-800",
    SPEAKER: "bg-green-100 text-green-800",
    GENERAL: "bg-gray-100 text-gray-800",
  };
  return map[category] ?? "bg-gray-100 text-gray-800";
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

export function interpolateTemplate(
  template: string,
  data: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? "");
}
