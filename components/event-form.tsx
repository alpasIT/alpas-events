"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { eventSchema, type EventInput } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EventFormProps {
  event?: EventInput & { id: string };
  onSuccess?: () => void;
}

const TIMEZONES = [
  "Asia/Manila",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Bangkok",
  "Asia/Kuala_Lumpur",
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
];

export function EventForm({ event, onSuccess }: EventFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isEdit = !!event;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EventInput>({
    resolver: zodResolver(eventSchema),
    defaultValues: event ?? { timezone: "Asia/Manila" },
  });

  const timezone = watch("timezone");

  async function onSubmit(data: EventInput) {
    setLoading(true);
    try {
      const url = isEdit ? `/api/events/${event.id}` : "/api/events";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to save event");
      }

      const saved = await res.json();
      toast.success(isEdit ? "Event updated" : "Event created");
      router.push(`/events/${saved.id}`);
      router.refresh();
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-2xl">
      <div className="space-y-1">
        <Label>Event Name *</Label>
        <Input {...register("name")} placeholder="Annual Gala Dinner 2026" />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Date *</Label>
          <Input {...register("date")} type="date" />
          {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>Timezone</Label>
          <Select value={timezone} onValueChange={(v) => setValue("timezone", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>{tz}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Start Time *</Label>
          <Input {...register("startTime")} type="datetime-local" />
          {errors.startTime && <p className="text-xs text-destructive">{errors.startTime.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>End Time</Label>
          <Input {...register("endTime")} type="datetime-local" />
        </div>
      </div>

      <div className="space-y-1">
        <Label>Venue *</Label>
        <Input {...register("venue")} placeholder="Grand Ballroom, Manila Hotel" />
        {errors.venue && <p className="text-xs text-destructive">{errors.venue.message}</p>}
      </div>

      <div className="space-y-1">
        <Label>RSVP Deadline *</Label>
        <Input {...register("rsvpDeadline")} type="datetime-local" />
        {errors.rsvpDeadline && <p className="text-xs text-destructive">{errors.rsvpDeadline.message}</p>}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : isEdit ? "Update Event" : "Create Event"}
        </Button>
      </div>
    </form>
  );
}
