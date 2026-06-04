import { EventForm } from "@/components/event-form";

export default function NewEventPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create Event</h1>
        <p className="text-muted-foreground text-sm">Set up a new event</p>
      </div>
      <EventForm />
    </div>
  );
}
