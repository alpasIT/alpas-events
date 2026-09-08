import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CheckInPageProps {
  searchParams: Promise<{ token?: string }>;
}

/**
 * Guest QR deep links land here. Check-in itself requires a staff session
 * via the dashboard scanner — this page no longer auto-POSTs on load.
 */
export default async function CheckInPage({ searchParams }: CheckInPageProps) {
  const { token } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="max-w-md w-full text-center space-y-4 rounded-xl border bg-white p-8 shadow-sm">
        <ShieldCheck className="h-16 w-16 text-primary mx-auto" />
        <h1 className="text-2xl font-bold">Staff check-in required</h1>
        <p className="text-muted-foreground">
          Guest QR codes can only be checked in by authorized staff using the
          in-app scanner. Opening this link does not mark attendance.
        </p>
        {token ? (
          <p className="text-xs text-muted-foreground break-all rounded-md bg-muted px-3 py-2">
            Token present — present this QR to event staff.
          </p>
        ) : (
          <p className="text-sm text-destructive">No check-in token was found in this link.</p>
        )}
        <Button asChild className="w-full">
          <Link href="/login">Staff sign in</Link>
        </Button>
      </div>
    </div>
  );
}
