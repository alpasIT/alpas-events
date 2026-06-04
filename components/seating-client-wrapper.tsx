"use client";

import dynamic from "next/dynamic";

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

interface Props {
  eventId: string;
  initialTables: TableData[];
  initialGuests: GuestSlim[];
}

const SeatingClient = dynamic(
  () => import("@/components/seating-client").then((m) => m.SeatingClient),
  { ssr: false }
);

export function SeatingClientWrapper(props: Props) {
  return <SeatingClient {...props} />;
}
