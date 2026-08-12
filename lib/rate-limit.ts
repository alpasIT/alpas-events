import { NextRequest } from "next/server";

// Best-effort only: counters live in function memory, so they reset on cold
// start and aren't shared across concurrent instances. Good enough to blunt
// casual abuse/spam, not a substitute for a distributed limiter (e.g. Upstash).
const buckets = new Map<string, { count: number; resetAt: number }>();

export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/** Returns true if the request is within the limit, false if it should be rejected (429). */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;

  bucket.count += 1;
  return true;
}
