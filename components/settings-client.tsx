"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EventDetailsForm } from "@/components/event-details-form";

interface SettingsClientProps {
  eventId: string;
  canEdit: boolean;
  eventName: string;
  eventVenue: string;
  eventDate: string;
  eventStartTime: string;
  eventEndTime: string;
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
  canEdit,
  eventName,
  eventVenue,
  eventDate,
  eventStartTime,
  eventEndTime,
  initialEnablePlusOne,
  initialEnableDietaryPreference,
}: SettingsClientProps) {
  const router = useRouter();
  const [enablePlusOne, setEnablePlusOne] = useState(initialEnablePlusOne);
  const [enableDietaryPreference, setEnableDietaryPreference] = useState(
    initialEnableDietaryPreference
  );
  const [saving, setSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  async function handleDeleteEvent() {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Event deleted successfully");
      router.push("/events");
    } catch {
      toast.error("Failed to delete event");
      setIsDeleting(false);
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
          <CardTitle>Event Details</CardTitle>
          <CardDescription>
            {canEdit
              ? "Update the event name, venue, and dates."
              : "Core event information (read-only — you are not the event creator)."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {canEdit ? (
            <EventDetailsForm
              eventId={eventId}
              defaultValues={{
                name: eventName,
                venue: eventVenue,
                date: eventDate,
                startTime: eventStartTime,
                endTime: eventEndTime,
              }}
            />
          ) : (
            <dl className="space-y-2 text-sm">
              <div className="flex gap-2">
                <dt className="font-medium w-24 shrink-0">Name</dt>
                <dd className="text-muted-foreground">{eventName}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium w-24 shrink-0">Venue</dt>
                <dd className="text-muted-foreground">{eventVenue}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium w-24 shrink-0">Date</dt>
                <dd className="text-muted-foreground">{eventDate}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium w-24 shrink-0">Start Time</dt>
                <dd className="text-muted-foreground">{eventStartTime}</dd>
              </div>
              {eventEndTime && (
                <div className="flex gap-2">
                  <dt className="font-medium w-24 shrink-0">End Time</dt>
                  <dd className="text-muted-foreground">{eventEndTime}</dd>
                </div>
              )}
            </dl>
          )}
        </CardContent>
      </Card>

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

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle>Danger Zone</CardTitle>
          <CardDescription>
            Permanently delete this event and all associated data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => setShowDeleteDialog(true)}
            disabled={isDeleting}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Event
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Event</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this event? This action cannot be undone and will permanently delete the event and all associated data including guests, invitations, and attendance records.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteEvent}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Event"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
