import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface Params {
  params: Promise<{ token: string }>;
}

export async function GET(_: NextRequest, { params }: Params) {
  try {
    const { token } = await params;

    console.log(`[Feedback API] Fetching feedback for token: ${token.substring(0, 10)}...`);

    // Query directly from database using raw SQL to avoid Prisma model issues
    const result = await prisma.$queryRaw`
      SELECT 
        ef.id,
        ef.event_id as "eventId",
        ef.guest_id as "guestId",
        ef.token,
        ef.rating,
        ef.comment,
        ef.submitted_at as "submittedAt",
        ef.created_at as "createdAt",
        ef.updated_at as "updatedAt",
        e.id as "event_id",
        e.name as "event_name",
        g.id as "guest_id",
        g.full_name as "guest_fullName",
        g.email as "guest_email",
        g.salutation as "guest_salutation"
      FROM event_feedback ef
      LEFT JOIN events e ON ef.event_id = e.id
      LEFT JOIN guests g ON ef.guest_id = g.id
      WHERE ef.token = ${token}
      LIMIT 1
    `;

    if (!result || (result as any[]).length === 0) {
      console.log(`[Feedback API] Token not found: ${token}`);
      return NextResponse.json({ error: "Invalid feedback token" }, { status: 404 });
    }

    const row = (result as any[])[0];
    console.log(`[Feedback API] Feedback found for guest: ${row.guest_fullName}`);

    const feedback = {
      id: row.id,
      eventId: row.eventId,
      guestId: row.guestId,
      token: row.token,
      rating: row.rating,
      comment: row.comment,
      submittedAt: row.submittedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      event: {
        id: row.event_id,
        name: row.event_name,
      },
      guest: {
        id: row.guest_id,
        fullName: row.guest_fullName,
        email: row.guest_email,
        salutation: row.guest_salutation,
      },
    };

    return NextResponse.json({ success: true, feedback });
  } catch (err) {
    console.error(`[Feedback API] Error:`, err);
    return NextResponse.json({ error: "Failed to fetch feedback" }, { status: 500 });
  }
}
