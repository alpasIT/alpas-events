"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface SettingsClientProps {
  eventId: string;
  initialEnablePlusOne: boolean;
  initialEnableDietaryPreference: boolean;
}

function Toggle({
  enabled,
  onChange,
  disabled,
}: {
  enabled: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
        enabled ? "bg-primary" : "bg-input"
      }`}
    >
      <span
        className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform duration-200 ${
          enabled ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export function SettingsClient({
  eventId,
  initialEnablePlusOne,
  initialEnableDietaryPreference,
}: SettingsClientProps) {
  const [enablePlusOne, setEnablePlusOne] = useState(initialEnablePlusOne);
  const [enableDietaryPreference, setEnableDietaryPreference] = useState(
    initialEnableDietaryPreference
  );
  const [saving, setSaving] = useState(false);

  async function updateSetting(field: string, value: boolean) {
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${eventId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Setting updated");
    } catch {
      toast.error("Failed to update setting");
      // Revert optimistic update
      if (field === "enablePlusOne") setEnablePlusOne(!value);
      if (field === "enableDietaryPreference") setEnableDietaryPreference(!value);
    } finally {
      setSaving(false);
    }
  }

  function handlePlusOne(val: boolean) {
    setEnablePlusOne(val);
    updateSetting("enablePlusOne", val);
  }

  function handleDietary(val: boolean) {
    setEnableDietaryPreference(val);
    updateSetting("enableDietaryPreference", val);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>RSVP Form Options</CardTitle>
          <CardDescription>
            Choose which additional fields guests see when they confirm attendance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Plus One */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="font-medium text-sm">Plus One Name</p>
              <p className="text-sm text-muted-foreground">
                Allow guests to enter the name of a companion when accepting.
              </p>
            </div>
            <Toggle
              enabled={enablePlusOne}
              onChange={handlePlusOne}
              disabled={saving}
            />
          </div>

          <div className="border-t" />

          {/* Dietary Preference */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="font-medium text-sm">Dietary Preference</p>
              <p className="text-sm text-muted-foreground">
                Allow guests to specify dietary requirements (e.g. Vegetarian, Halal).
              </p>
            </div>
            <Toggle
              enabled={enableDietaryPreference}
              onChange={handleDietary}
              disabled={saving}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
