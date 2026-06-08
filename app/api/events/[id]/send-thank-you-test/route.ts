import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * SIMPLE TEST ENDPOINT
 * This endpoint tests each component independently:
 * 1. Database connectivity
 * 2. Template lookup
 * 3. Attendee query
 * 4. Email sending
 */
export async function GET(_: NextRequest, { params }: Params) {
  const { id: eventId } = await params;

  const tests: Record<string, any> = {};

  try {
    // Test 1: Auth
    console.log("[TEST] 1. Testing auth...");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    tests.auth = user ? "✅ OK" : "❌ FAILED";
    if (!user) throw new Error("Not authenticated");

    // Test 2: Admin lookup
    console.log("[TEST] 2. Testing admin lookup...");
    const admin = await prisma.adminUser.findUnique({ where: { email: user.email! } });
    tests.adminLookup = admin ? "✅ OK" : "❌ FAILED";
    if (!admin) throw new Error("Admin not found");

    // Test 3: Event lookup
    console.log("[TEST] 3. Testing event lookup...");
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    tests.eventLookup = event ? `✅ OK (${event.name})` : "❌ FAILED";
    if (!event) throw new Error("Event not found");

    // Test 4: Count attendees by status
    console.log("[TEST] 4. Counting attendees by status...");
    const statusCounts = await prisma.guest.groupBy({
      by: ["attendanceStatus"],
      where: { eventId },
      _count: true,
    });
    tests.attendeeStatusCounts = Object.fromEntries(
      statusCounts.map((s) => [s.attendanceStatus, s._count])
    );

    // Test 5: Find confirmed attendees
    console.log("[TEST] 5. Finding confirmed attendees...");
    const confirmed = await prisma.guest.findMany({
      where: { eventId, attendanceStatus: "CONFIRMED_PRESENT" },
      select: { id: true, fullName: true, email: true },
    });
    tests.confirmedCount = confirmed.length;
    tests.confirmedEmails = confirmed.map(g => g.email);

    // Test 6: Find THANK_YOU template
    console.log("[TEST] 6. Finding THANK_YOU template...");
    const template = await prisma.emailTemplate.findFirst({
      where: { eventId, type: "THANK_YOU" },
      select: { id: true, name: true, subject: true, senderName: true },
    });
    tests.templateFound = template ? `✅ OK (${template.name})` : "❌ NOT FOUND";

    // Test 7: Check environment variables
    console.log("[TEST] 7. Checking environment variables...");
    tests.environment = {
      RESEND_API_KEY: process.env.RESEND_API_KEY ? "✅ SET" : "❌ MISSING",
      EMAIL_FROM: process.env.EMAIL_FROM ? `✅ SET (${process.env.EMAIL_FROM})` : "❌ MISSING",
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ? `✅ SET (${process.env.NEXT_PUBLIC_APP_URL})` : "❌ MISSING",
    };

    // Test 8: Send test email
    if (confirmed.length > 0 && template) {
      console.log("[TEST] 8. Sending test email...");
      const testGuest = confirmed[0];
      const result = await sendEmail({
        to: testGuest.email,
        subject: `[TEST] ${template.subject}`,
        htmlBody: `<p>This is a test email to verify the thank you email system is working.</p><p>Recipient: ${testGuest.fullName}</p>`,
        from: `${template.senderName} <${process.env.EMAIL_FROM}>`,
        replyTo: template.senderName,
      });
      tests.testEmailSent = result.success ? `✅ OK (sent to ${testGuest.email})` : `❌ FAILED (${result.error})`;
    }

    // Test 9: Check EventFeedback table
    console.log("[TEST] 9. Checking EventFeedback table...");
    try {
      const feedbackCount = await prisma.eventFeedback.count({ where: { eventId } });
      tests.eventFeedbackTable = `✅ OK (${feedbackCount} records)`;
    } catch (err) {
      tests.eventFeedbackTable = `❌ FAILED (Table may not exist - did you run migration?)`;
    }

    return NextResponse.json({ success: true, tests }, { status: 200 });
  } catch (err) {
    tests.error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, tests }, { status: 500 });
  }
}
