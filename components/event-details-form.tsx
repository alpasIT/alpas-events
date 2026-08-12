"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  name: z.string().min(1, "Event name is required").max(150),
  venue: z.string().min(1, "Venue is required").max(250),
  date: z.string().min(1, "Date is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface EventDetailsFormProps {
  eventId: string;
  defaultValues: FormValues;
}

export function EventDetailsForm({ eventId, defaultValues }: EventDetailsFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  async function onSubmit(data: FormValues) {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to update event");
      }

      toast.success("Event details updated");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1">
        <Label>Event Name *</Label>
        <Input {...register("name")} placeholder="Annual Gala Dinner 2026" />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-1">
        <Label>Venue *</Label>
        <Input {...register("venue")} placeholder="Grand Ballroom, Manila Hotel" />
        {errors.venue && <p className="text-xs text-destructive">{errors.venue.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Date *</Label>
          <Input {...register("date")} type="date" />
          {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>Start Time *</Label>
          <Input {...register("startTime")} type="datetime-local" />
          {errors.startTime && <p className="text-xs text-destructive">{errors.startTime.message}</p>}
        </div>
      </div>

      <div className="space-y-1">
        <Label>End Time</Label>
        <Input {...register("endTime")} type="datetime-local" />
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
