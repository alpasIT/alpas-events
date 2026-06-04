"use client";

import { useState } from "react";
import { CheckCircle, UserCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PlusOneItem {
  id: string;
  name: string;
  checkedIn: boolean;
}

interface PlusOneCheckInButtonProps {
  token: string;
  plusOnes: PlusOneItem[];
}

export function PlusOneCheckInButton({ token, plusOnes: initialPlusOnes }: PlusOneCheckInButtonProps) {
  const [items, setItems] = useState<PlusOneItem[]>(initialPlusOnes);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleCheckIn(plusOneId: string) {
    setLoadingId(plusOneId);
    setErrors((prev) => ({ ...prev, [plusOneId]: "" }));
    try {
      const res = await fetch("/api/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, plusOneId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors((prev) => ({ ...prev, [plusOneId]: data.error ?? "Check-in failed" }));
      } else {
        setItems((prev) => prev.map((p) => p.id === plusOneId ? { ...p, checkedIn: true } : p));
      }
    } catch {
      setErrors((prev) => ({ ...prev, [plusOneId]: "Connection error. Please try again." }));
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-2">
      {items.map((p) =>
        p.checkedIn ? (
          <div
            key={p.id}
            className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5"
          >
            <CheckCircle className="h-4 w-4 shrink-0" />
            <span><strong>{p.name}</strong> (plus-one) checked in</span>
          </div>
        ) : (
          <div key={p.id} className="space-y-1">
            <Button
              variant="outline"
              className="w-full gap-2 border-green-400 text-green-700 hover:bg-green-50"
              onClick={() => handleCheckIn(p.id)}
              disabled={loadingId === p.id}
            >
              {loadingId === p.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserCheck className="h-4 w-4" />
              )}
              Check in +1: {p.name}
            </Button>
            {errors[p.id] && (
              <p className="text-xs text-destructive text-center">{errors[p.id]}</p>
            )}
          </div>
        )
      )}
    </div>
  );
}
