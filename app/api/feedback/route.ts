import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  if (!checkRateLimit(`feedback:${getClientIp(request)}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many requests, please try again shortly" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { token, rating, comment } = body as {
      token: string;
      rating: number;
      comment?: string;
    };

    console.log(`[Feedback Submit] Received submission for token: ${token.substring(0, 10)}...`);

    if (!token || !rating) {
      console.log(`[Feedback Submit] Missing token or rating`);
      return NextResponse.json({ error: "Token and rating are required" }, { status: 400 });
    }

    if (rating < 1 || rating > 5) {
      console.log(`[Feedback Submit] Invalid rating: ${rating}`);
      return NextResponse.json({ error: "Rating must be between 1 and 5" }, { status: 400 });
    }

    console.log(`[Feedback Submit] Processing: rating=${rating}, comment=${comment ? "yes" : "no"}`);

    // Check if feedback exists and hasn't been submitted
    const result = await prisma.$queryRaw`
      SELECT id, submitted_at FROM event_feedback WHERE token = ${token} LIMIT 1
    `;

    const existing = (result as any[])[0];

    if (!existing) {
      console.log(`[Feedback Submit] Token not found`);
      return NextResponse.json({ error: "Feedback token not found" }, { status: 404 });
    }

    if (existing.submitted_at) {
      console.log(`[Feedback Submit] Already submitted`);
      return NextResponse.json({ error: "Feedback already submitted" }, { status: 400 });
    }

    console.log(`[Feedback Submit] Updating feedback in database...`);

    // Update feedback using raw SQL
    const trimmedComment = comment?.trim() || null;
    await prisma.$executeRaw`
      UPDATE event_feedback 
      SET 
        rating = ${rating},
        comment = ${trimmedComment},
        submitted_at = NOW(),
        updated_at = NOW()
      WHERE token = ${token}
    `;

    console.log(`[Feedback Submit] ✅ Feedback updated successfully`);

    // Try to log activity (best effort)
    try {
      const feedbackData = await prisma.$queryRaw`
        SELECT event_id, guest_id FROM event_feedback WHERE token = ${token} LIMIT 1
      `;
      const feedback = (feedbackData as any[])[0];

      if (feedback) {
        await prisma.activityLog.create({
          data: {
            eventId: feedback.event_id,
            type: "INVITATION_SENT",
            description: `Guest submitted event feedback: ${rating}/5 stars${comment ? " with comment" : ""}`,
            guestId: feedback.guest_id,
          },
        });
        console.log(`[Feedback Submit] Activity log created`);
      }
    } catch (logErr) {
      console.warn(`[Feedback Submit] Activity log failed (non-critical):`, logErr instanceof Error ? logErr.message : String(logErr));
    }

    return NextResponse.json({
      success: true,
      message: "Feedback submitted successfully",
    });
  } catch (err) {
    console.error("[Feedback Submit] Error:", err);
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
  }
}
