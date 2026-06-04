"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Users, GripVertical, Search } from "lucide-react";
import { cn, getCategoryColor } from "@/lib/utils";

interface GuestSlim {
  id: string;
  fullName: string;
  salutation: string | null;
  company: string;
  category: string;
  attendanceStatus: string;
  seatId: string | null;
}

interface SeatSlim {
  id: string;
  tableId: string;
  seatNumber: number;
  assignedAt: string | null;
  guest: GuestSlim | null;
}

interface TableData {
  id: string;
  label: string;
  capacity: number;
  seats: SeatSlim[];
}

interface SeatingClientProps {
  eventId: string;
  initialTables: TableData[];
  initialGuests: GuestSlim[];
}

// ── Draggable guest card ──────────────────────────────────────────────────────
function DraggableGuest({ guest, isDragging }: { guest: GuestSlim; isDragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: guest.id,
    data: { guest },
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "flex items-center gap-2 px-2.5 py-2 rounded-md border bg-white text-sm cursor-grab select-none group",
        isDragging && "opacity-40",
      )}
    >
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate leading-none">
          {guest.salutation ? `${guest.salutation} ` : ""}
          {guest.fullName}
        </p>
        <p className="text-[11px] text-muted-foreground truncate mt-0.5">{guest.company}</p>
      </div>
      <span className={cn("text-[10px] rounded-full px-1.5 py-0.5 font-medium shrink-0", getCategoryColor(guest.category))}>
        {guest.category}
      </span>
    </div>
  );
}

// ── Droppable table ──────────────────────────────────────────────────────────
function DroppableTable({
  table,
  assignedGuests,
  onDelete,
  onUnassign,
  draggedGuestId,
}: {
  table: TableData;
  assignedGuests: GuestSlim[];
  onDelete: () => void;
  onUnassign: (guestId: string) => void;
  draggedGuestId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: table.id });
  const isFull = assignedGuests.length >= table.capacity;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "border rounded-xl p-4 space-y-3 transition-colors min-h-[160px]",
        isOver && !isFull ? "border-primary bg-primary/5" : "border-border bg-muted/20",
        isOver && isFull ? "border-destructive bg-destructive/5" : "",
      )}
    >
      {/* Table header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-sm">{table.label}</h3>
          <p className={cn("text-xs", isFull ? "text-destructive font-medium" : "text-muted-foreground")}>
            {assignedGuests.length} / {table.capacity} seats
          </p>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Assigned guests */}
      <div className="space-y-1.5">
        {assignedGuests.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-3 border-dashed border rounded-md">
            Drop guests here
          </p>
        )}
        {assignedGuests.map((g) => (
          <div key={g.id} className="flex items-center gap-2 px-2.5 py-2 rounded-md border bg-white text-sm group">
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate leading-none text-xs">
                {g.salutation ? `${g.salutation} ` : ""}{g.fullName}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">{g.company}</p>
            </div>
            <button
              onClick={() => onUnassign(g.id)}
              className="text-[10px] text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Droppable unassigned pool ─────────────────────────────────────────────────
function DroppableUnassigned({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "unassigned" });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "space-y-1.5 min-h-[60px] rounded-lg transition-colors p-1",
        isOver && "bg-orange-50 ring-1 ring-orange-300",
      )}
    >
      {children}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export function SeatingClient({ eventId, initialTables, initialGuests }: SeatingClientProps) {
  const [tables, setTables] = useState<TableData[]>(initialTables);
  const [guests, setGuests] = useState<GuestSlim[]>(initialGuests);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Add table dialog
  const [addOpen, setAddOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newCapacity, setNewCapacity] = useState("10");
  const [addLoading, setAddLoading] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const getGuestById = useCallback((id: string) => guests.find((g) => g.id === id), [guests]);

  const unassignedGuests = guests.filter((g) => !g.seatId);
  const filteredUnassigned = search.trim()
    ? unassignedGuests.filter(
        (g) =>
          g.fullName.toLowerCase().includes(search.toLowerCase()) ||
          g.company.toLowerCase().includes(search.toLowerCase()),
      )
    : unassignedGuests;

  function getTableGuests(table: TableData): GuestSlim[] {
    const seatIds = new Set(table.seats.map((s) => s.id));
    return guests.filter((g) => g.seatId && seatIds.has(g.seatId));
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(event.active.id as string);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;

    const guestId = active.id as string;
    const targetId = over.id as string;
    const guest = getGuestById(guestId);
    if (!guest) return;

    const currentTableId = tables.find((t) => t.seats.some((s) => s.id === guest.seatId))?.id ?? "unassigned";
    if (targetId === currentTableId) return;

    // Optimistic update
    if (targetId === "unassigned") {
      setGuests((prev) => prev.map((g) => (g.id === guestId ? { ...g, seatId: null } : g)));
      setTables((prev) =>
        prev.map((t) => ({ ...t, seats: t.seats.filter((s) => s.id !== guest.seatId) })),
      );
    } else {
      const targetTable = tables.find((t) => t.id === targetId);
      if (!targetTable) return;
      if (targetTable.seats.length >= targetTable.capacity) {
        toast.error(`"${targetTable.label}" is full`);
        return;
      }
      const fakeSeatId = `tmp-${Date.now()}`;
      const fakeSeat: SeatSlim = { id: fakeSeatId, tableId: targetId, seatNumber: targetTable.seats.length + 1, assignedAt: null, guest };
      setGuests((prev) => prev.map((g) => (g.id === guestId ? { ...g, seatId: fakeSeatId } : g)));
      setTables((prev) =>
        prev.map((t) => {
          if (t.id === targetId) return { ...t, seats: [...t.seats.filter((s) => s.id !== guest.seatId), fakeSeat] };
          return { ...t, seats: t.seats.filter((s) => s.id !== guest.seatId) };
        }),
      );
    }

    // Persist to API
    try {
      const apiTableId = targetId === "unassigned" ? "unassign" : targetId;
      const res = await fetch(`/api/events/${eventId}/tables/${apiTableId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestId }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to assign seat");
        // Revert — re-fetch
        refetch();
      }
    } catch {
      toast.error("Failed to assign seat");
      refetch();
    }
  }

  async function refetch() {
    const res = await fetch(`/api/events/${eventId}/tables`);
    if (res.ok) {
      const updated = await res.json();
      setTables(updated);
    }
  }

  async function handleUnassign(guestId: string) {
    const guest = getGuestById(guestId);
    if (!guest) return;
    setGuests((prev) => prev.map((g) => (g.id === guestId ? { ...g, seatId: null } : g)));
    setTables((prev) =>
      prev.map((t) => ({ ...t, seats: t.seats.filter((s) => s.id !== guest.seatId) })),
    );
    try {
      await fetch(`/api/events/${eventId}/tables/unassign/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestId }),
      });
    } catch {
      toast.error("Failed to unassign guest");
      refetch();
    }
  }

  async function handleDeleteTable(tableId: string) {
    const table = tables.find((t) => t.id === tableId);
    if (!table) return;
    // Free guests optimistically
    const seatIds = new Set(table.seats.map((s) => s.id));
    setGuests((prev) => prev.map((g) => (g.seatId && seatIds.has(g.seatId) ? { ...g, seatId: null } : g)));
    setTables((prev) => prev.filter((t) => t.id !== tableId));
    try {
      const res = await fetch(`/api/events/${eventId}/tables/${tableId}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Failed to delete table");
        refetch();
      } else {
        toast.success(`"${table.label}" deleted`);
      }
    } catch {
      toast.error("Failed to delete table");
      refetch();
    }
  }

  async function handleAddTable() {
    if (!newLabel.trim()) { toast.error("Table name is required"); return; }
    const cap = parseInt(newCapacity, 10);
    if (isNaN(cap) || cap < 1) { toast.error("Capacity must be at least 1"); return; }
    setAddLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/tables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel.trim(), capacity: cap }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to create table");
        return;
      }
      const table = await res.json();
      setTables((prev) => [...prev, table]);
      toast.success(`"${table.label}" added`);
      setAddOpen(false);
      setNewLabel("");
      setNewCapacity("10");
    } finally {
      setAddLoading(false);
    }
  }

  const activeGuest = activeDragId ? getGuestById(activeDragId) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <p className="text-sm text-muted-foreground flex-1">
          Drag accepted guests from the unassigned pool onto a table. Only guests who have RSVP&apos;d are shown.
        </p>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Table
        </Button>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          {/* ── Left: Unassigned guests ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold text-sm">Unassigned ({unassignedGuests.length})</h2>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search guests…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
            <DroppableUnassigned>
              {filteredUnassigned.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {unassignedGuests.length === 0 ? "All guests assigned!" : "No matches"}
                </p>
              ) : (
                filteredUnassigned.map((g) => (
                  <DraggableGuest key={g.id} guest={g} isDragging={activeDragId === g.id} />
                ))
              )}
            </DroppableUnassigned>
          </div>

          {/* ── Right: Tables ── */}
          <div className="space-y-3">
            <h2 className="font-semibold text-sm">Tables ({tables.length})</h2>
            {tables.length === 0 ? (
              <div className="border-2 border-dashed rounded-xl p-12 text-center space-y-2">
                <p className="text-muted-foreground text-sm">No tables yet.</p>
                <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Add First Table
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {tables.map((table) => (
                  <DroppableTable
                    key={table.id}
                    table={table}
                    assignedGuests={getTableGuests(table)}
                    onDelete={() => handleDeleteTable(table.id)}
                    onUnassign={handleUnassign}
                    draggedGuestId={activeDragId}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <DragOverlay>
          {activeGuest ? (
            <div className="flex items-center gap-2 px-2.5 py-2 rounded-md border bg-white shadow-lg text-sm opacity-95 w-60">
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate leading-none">
                  {activeGuest.salutation ? `${activeGuest.salutation} ` : ""}{activeGuest.fullName}
                </p>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{activeGuest.company}</p>
              </div>
              <Badge variant="outline" className={cn("text-[10px]", getCategoryColor(activeGuest.category))}>
                {activeGuest.category}
              </Badge>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* ── Add Table Dialog ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Table</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="table-label">Table Name</Label>
              <Input
                id="table-label"
                placeholder="e.g. Table 1, VIP Table A"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddTable()}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="table-cap">Capacity (seats)</Label>
              <Input
                id="table-cap"
                type="number"
                min={1}
                max={100}
                value={newCapacity}
                onChange={(e) => setNewCapacity(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={addLoading}>Cancel</Button>
            <Button onClick={handleAddTable} disabled={addLoading || !newLabel.trim()}>
              {addLoading ? "Adding…" : "Add Table"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
