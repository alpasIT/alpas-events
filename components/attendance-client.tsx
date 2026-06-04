"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, CheckCircle, UserCheck, UserX, UserPlus, ChevronDown, Download } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { QRScanner } from "@/components/qr-scanner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BadgePrintButton } from "@/components/badge-print-button";
import { cn, getRsvpStatusColor, getAttendanceStatusColor, getCategoryColor, formatDateTime } from "@/lib/utils";

interface AttendanceGuest {
  id: string;
  fullName: string;
  email: string;
  company: string;
  designation: string | null;
  category: string;
  rsvpStatus: string;
  attendanceStatus: string;
  attendanceMarkedAt: string | null;
  salutation: string | null;
  plusOnes: { id: string; name: string; checkedIn: boolean }[];
}

interface AttendanceClientProps {
  eventId: string;
  initialGuests: AttendanceGuest[];
}

type CheckInStatus = "CONFIRMED_PRESENT" | "WALK_IN_OVERRIDE";

export function AttendanceClient({ eventId, initialGuests }: AttendanceClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Manual check-in search state
  const [quickSearch, setQuickSearch] = useState("");
  const [quickOpen, setQuickOpen] = useState(false);
  const quickRef = useRef<HTMLDivElement>(null);

  // Walk-in dialog state
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [walkInLoading, setWalkInLoading] = useState(false);
  const [walkInForm, setWalkInForm] = useState({
    fullName: "",
    company: "",
    mobile: "",
    email: "",
    category: "GENERAL",
  });

  const filtered = initialGuests.filter((g) => {
    const q = search.toLowerCase();
    return (
      !search ||
      g.fullName.toLowerCase().includes(q) ||
      g.email.toLowerCase().includes(q) ||
      g.company.toLowerCase().includes(q)
    );
  });

  const quickMatches = quickSearch.trim().length >= 1
    ? initialGuests.filter((g) => {
        const q = quickSearch.toLowerCase();
        return (
          g.fullName.toLowerCase().includes(q) ||
          g.email.toLowerCase().includes(q) ||
          g.company.toLowerCase().includes(q)
        );
      })
    : [];

  async function handleMarkStatus(guestId: string, status: CheckInStatus, inQuick = false) {
    setLoadingId(guestId);
    const res = await fetch(`/api/events/${eventId}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestId, status }),
    });

    if (res.ok) {
      toast.success(
        status === "WALK_IN_OVERRIDE" ? "Marked as walk-in override!" : "Checked in!"
      );
      if (inQuick) {
        setQuickSearch("");
        setQuickOpen(false);
      }
      router.refresh();
    } else {
      const err = await res.json();
      toast.error(err.error ?? "Failed to check in");
    }
    setLoadingId(null);
  }

  async function handleAddWalkIn() {
    if (!walkInForm.fullName.trim()) {
      toast.error("Full name is required");
      return;
    }
    setWalkInLoading(true);
    try {
      // 1. Create the guest record
      const createRes = await fetch(`/api/events/${eventId}/guests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: walkInForm.fullName.trim(),
          company: walkInForm.company.trim() || "Walk-in",
          email: walkInForm.email.trim() || `walkin-${Date.now()}@placeholder.local`,
          designation: "Walk-in",
          mobile: walkInForm.mobile.trim() || "N/A",
          category: walkInForm.category,
          invitationMethod: "QR_CODE",
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.json();
        toast.error(err.error ? JSON.stringify(err.error) : "Failed to create walk-in guest");
        return;
      }

      const newGuest = await createRes.json();

      // 2. Mark as UNREGISTERED_WALK_IN
      await fetch(`/api/events/${eventId}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestId: newGuest.id, status: "UNREGISTERED_WALK_IN" }),
      });

      toast.success(`${walkInForm.fullName} added as a walk-in!`);
      setWalkInOpen(false);
      setWalkInForm({ fullName: "", company: "", mobile: "", email: "", category: "GENERAL" });
      router.refresh();
    } finally {
      setWalkInLoading(false);
    }
  }

  // Close quick-search dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (quickRef.current && !quickRef.current.contains(e.target as Node)) {
        setQuickOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="space-y-6">
      {/* ── Manual Check-In Search ── */}
      <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Manual Check-In</p>
            <p className="text-xs text-muted-foreground">
              Search by name, email, or company. Use &ldquo;Add Walk-in&rdquo; for unregistered guests.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setWalkInOpen(true)}
          >
            <UserPlus className="h-3.5 w-3.5 mr-1.5" />
            Add Walk-in
          </Button>
        </div>

        <div className="relative max-w-sm" ref={quickRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Type guest name…"
            value={quickSearch}
            onChange={(e) => { setQuickSearch(e.target.value); setQuickOpen(true); }}
            onFocus={() => setQuickOpen(true)}
            className="pl-9"
            autoComplete="off"
          />

          {/* Dropdown results */}
          {quickOpen && quickMatches.length > 0 && (
            <div className="absolute z-50 top-full mt-1 w-full max-h-72 overflow-y-auto rounded-md border bg-popover shadow-lg">
              {quickMatches.map((g) => {
                const isPresent = g.attendanceStatus === "CONFIRMED_PRESENT" || g.attendanceStatus === "WALK_IN_OVERRIDE";
                return (
                  <div
                    key={g.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-accent border-b last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {g.salutation ? `${g.salutation} ` : ""}{g.fullName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{g.company || g.email}</p>
                      <span className={cn("inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium mt-0.5", getCategoryColor(g.category))}>
                        {g.category}
                      </span>
                    </div>
                    {isPresent ? (
                      <span className="flex items-center gap-1 text-xs text-green-600 font-medium shrink-0">
                        <CheckCircle className="h-4 w-4" />
                        {g.attendanceStatus === "WALK_IN_OVERRIDE" ? "Walk-in" : "Checked in"}
                      </span>
                    ) : (
                      <CheckInButton
                        guestId={g.id}
                        loading={loadingId === g.id}
                        onSelect={(status) => handleMarkStatus(g.id, status, true)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {quickOpen && quickSearch.trim().length >= 1 && quickMatches.length === 0 && (
            <div className="absolute z-50 top-full mt-1 w-full rounded-md border bg-popover shadow-lg px-3 py-3 flex items-center gap-2 text-sm text-muted-foreground">
              <UserX className="h-4 w-4 shrink-0" />
              No guests found — use &ldquo;Add Walk-in&rdquo; for unregistered guests
            </div>
          )}
        </div>
      </div>

      {/* ── Tabs: full list + QR scanner ── */}
      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">Guest List</TabsTrigger>
          <TabsTrigger value="qr">QR Scanner</TabsTrigger>
        </TabsList>

        <TabsContent value="qr" className="mt-4">
          <QRScanner eventId={eventId} onCheckIn={() => router.refresh()} />
        </TabsContent>

        <TabsContent value="list" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter guest list…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <a href={`/api/events/${eventId}/export?report=attendance&format=xlsx`} download>
                    Attendance Report (Excel)
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href={`/api/events/${eventId}/export?report=attendance&format=csv`} download>
                    Attendance Report (CSV)
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href={`/api/events/${eventId}/export?report=no-show&format=xlsx`} download>
                    No-Show Report (Excel)
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>RSVP</TableHead>
                  <TableHead>Attendance</TableHead>
                  <TableHead>Checked In At</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                      No guests found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((guest) => {
                    const isPresent =
                      guest.attendanceStatus === "CONFIRMED_PRESENT" ||
                      guest.attendanceStatus === "WALK_IN_OVERRIDE" ||
                      guest.attendanceStatus === "UNREGISTERED_WALK_IN";
                    return (
                      <TableRow
                        key={guest.id}
                        className={isPresent ? "bg-green-50" : undefined}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">
                              {guest.salutation ? `${guest.salutation} ` : ""}{guest.fullName}
                            </p>
                            <p className="text-xs text-muted-foreground">{guest.company}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", getCategoryColor(guest.category))}>
                            {guest.category}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", getRsvpStatusColor(guest.rsvpStatus))}>
                            {guest.rsvpStatus}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", getAttendanceStatusColor(guest.attendanceStatus))}>
                            {guest.attendanceStatus.replace(/_/g, " ")}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {guest.attendanceMarkedAt ? formatDateTime(guest.attendanceMarkedAt) : "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {isPresent ? (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : (
                              <CheckInButton
                                guestId={guest.id}
                                loading={loadingId === guest.id}
                                onSelect={(status) => handleMarkStatus(guest.id, status)}
                              />
                            )}
                            <BadgePrintButton
                              guest={{
                                fullName: guest.fullName,
                                salutation: guest.salutation ?? undefined,
                                company: guest.company,
                                designation: guest.designation ?? "",
                                category: guest.category,
                                plusOneName: guest.plusOnes.map((p) => p.name).join(", ") || undefined,
                              }}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Add Walk-in Dialog ── */}
      <Dialog open={walkInOpen} onOpenChange={setWalkInOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Add Unregistered Walk-in
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="wi-name">Full Name <span className="text-destructive">*</span></Label>
              <Input
                id="wi-name"
                placeholder="e.g. Juan dela Cruz"
                value={walkInForm.fullName}
                onChange={(e) => setWalkInForm((f) => ({ ...f, fullName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wi-company">Company / Organization</Label>
              <Input
                id="wi-company"
                placeholder="Optional"
                value={walkInForm.company}
                onChange={(e) => setWalkInForm((f) => ({ ...f, company: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wi-mobile">Mobile Number</Label>
              <Input
                id="wi-mobile"
                type="tel"
                placeholder="Optional"
                value={walkInForm.mobile}
                onChange={(e) => setWalkInForm((f) => ({ ...f, mobile: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wi-email">Email</Label>
              <Input
                id="wi-email"
                type="email"
                placeholder="Optional"
                value={walkInForm.email}
                onChange={(e) => setWalkInForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wi-category">Category</Label>
              <Select
                value={walkInForm.category}
                onValueChange={(v) => setWalkInForm((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger id="wi-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["GENERAL", "VIP", "MEDIA", "SPONSOR", "SPEAKER"].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setWalkInOpen(false)} disabled={walkInLoading}>
              Cancel
            </Button>
            <Button onClick={handleAddWalkIn} disabled={walkInLoading || !walkInForm.fullName.trim()}>
              <UserPlus className="h-4 w-4 mr-1.5" />
              {walkInLoading ? "Adding…" : "Add Walk-in"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Reusable split check-in button ─────────────────────────────────────────
function CheckInButton({
  guestId,
  loading,
  onSelect,
}: {
  guestId: string;
  loading: boolean;
  onSelect: (status: CheckInStatus) => void;
}) {
  return (
    <div className="flex items-center">
      <Button
        size="sm"
        variant="outline"
        className="rounded-r-none border-r-0 pr-2"
        onClick={() => onSelect("CONFIRMED_PRESENT")}
        disabled={loading}
      >
        <UserCheck className="h-3.5 w-3.5 mr-1" />
        Check In
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="rounded-l-none px-1.5"
            disabled={loading}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onSelect("CONFIRMED_PRESENT")}>
            <UserCheck className="h-4 w-4 mr-2 text-green-600" />
            Check In (Confirmed Present)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSelect("WALK_IN_OVERRIDE")}>
            <UserPlus className="h-4 w-4 mr-2 text-orange-500" />
            Walk-in Override
            <span className="ml-2 text-xs text-muted-foreground">(declined/no RSVP)</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

