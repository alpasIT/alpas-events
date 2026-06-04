import Link from "next/link";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlusOneCheckInButton } from "@/components/plus-one-check-in-button";

interface CheckInPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function CheckInPage({ searchParams }: CheckInPageProps) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <XCircle className="h-16 w-16 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">Invalid QR Code</h1>
          <p className="text-muted-foreground">No check-in token was found in this QR code.</p>
        </div>
      </div>
    );
  }

  let result: {
    success: boolean;
    guestName?: string;
    category?: string;
    plusOnes?: { id: string; name: string; checkedIn: boolean }[];
    alreadyCheckedIn?: boolean;
    error?: string;
  } | null = null;

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const res = await fetch(`${appUrl}/api/check-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store",
    });

    result = await res.json();
    if (!res.ok) {
      result = { success: false, error: result?.error ?? "Check-in failed" };
    }
  } catch {
    result = { success: false, error: "Could not connect to server" };
  }

  if (!result?.success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-red-50">
        <div className="max-w-sm w-full text-center space-y-4">
          <XCircle className="h-16 w-16 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold text-destructive">Check-In Failed</h1>
          <p className="text-muted-foreground">{result?.error ?? "An error occurred during check-in."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-green-50">
      <div className="max-w-sm w-full text-center space-y-4">
        {result.alreadyCheckedIn ? (
          <AlertCircle className="h-20 w-20 text-yellow-500 mx-auto" />
        ) : (
          <CheckCircle className="h-20 w-20 text-green-600 mx-auto" />
        )}

        <h1 className={`text-3xl font-bold ${result.alreadyCheckedIn ? "text-yellow-700" : "text-green-700"}`}>
          {result.alreadyCheckedIn ? "Already Checked In" : "Welcome!"}
        </h1>

        <div className="space-y-1">
          <p className="text-xl font-semibold">{result.guestName}</p>
          {result.category && (
            <p className="text-sm text-muted-foreground capitalize">
              {result.category.replace(/_/g, " ")}
            </p>
          )}
        </div>

        {result.alreadyCheckedIn && (
          <p className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2">
            This guest has already been checked in.
          </p>
        )}

        {!result.alreadyCheckedIn && (
          <p className="text-green-600 font-medium">Successfully checked in</p>
        )}

        {/* Plus-one check-in */}
        {result.plusOnes && result.plusOnes.length > 0 && (
          <div className="pt-2">
            <PlusOneCheckInButton
              token={token}
              plusOnes={result.plusOnes}
            />
          </div>
        )}
      </div>
    </div>
  );
}
