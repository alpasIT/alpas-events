import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_: NextRequest, { params }: Params) {
  const { id: eventId } = await params;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Try to query the EventFeedback table
    console.log("[FEEDBACK-CHECK] Attempting to query EventFeedback table...");
    
    const feedbackRecords = await prisma.eventFeedback.findMany({
      where: { eventId },
      take: 5,
    });
    
    console.log("[FEEDBACK-CHECK] Query successful");
    console.log(`[FEEDBACK-CHECK] Found ${feedbackRecords.length} feedback records`);
    
    // Try to create a test record
    console.log("[FEEDBACK-CHECK] Attempting to create test feedback record...");
    
    const testGuest = await prisma.guest.findFirst({
      where: { eventId },
    });

    if (!testGuest) {
      return NextResponse.json({
        status: "error",
        message: "No guests found in this event",
      });
    }

    try {
      const testFeedback = await prisma.eventFeedback.create({
        data: {
          eventId,
          guestId: testGuest.id,
          token: `test-${Date.now()}`,
          rating: 0,
        },
      });
      
      console.log("[FEEDBACK-CHECK] Test record created successfully:", testFeedback.id);
      
      // Clean up test record
      await prisma.eventFeedback.delete({
        where: { id: testFeedback.id },
      });
      
      return NextResponse.json({
        status: "success",
        message: "EventFeedback table is working correctly",
        testPassed: true,
        existingRecords: feedbackRecords.length,
      });
    } catch (createErr) {
      console.error("[FEEDBACK-CHECK] Failed to create test record:", createErr);
      return NextResponse.json({
        status: "error",
        message: "EventFeedback table exists but cannot create records",
        error: createErr instanceof Error ? createErr.message : String(createErr),
        tableSchema: "May need to verify columns match Prisma schema",
      });
    }
  } catch (err) {
    console.error("[FEEDBACK-CHECK] Error:", err);
    return NextResponse.json({
      status: "error",
      message: "EventFeedback table check failed",
      error: err instanceof Error ? err.message : String(err),
      suggestion: "Verify the table exists in Supabase with columns: id, eventId, guestId, token (unique), rating (INT), comment (TEXT nullable), submittedAt (TIMESTAMP nullable), createdAt, updatedAt",
    });
  }
}
