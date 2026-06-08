import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { formatDate, formatDateTime, interpolateTemplate } from "@/lib/utils";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * SIMPLIFIED THANK YOU ENDPOINT (for testing without EventFeedback complexity)
 */
export async function POST(_: NextRequest, { params }: Params) {
  const { id: eventId } = await params;

  try {
    console.log(`[SIMPLE-TEST] Starting for event: ${eventId}`);

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log("[SIMPLE-TEST] No user found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log(`[SIMPLE-TEST] User authenticated: ${user.email}`);

    const admin = await prisma.adminUser.findUnique({ where: { email: user.email! } });
    if (!admin) {
      console.log("[SIMPLE-TEST] Admin not found");
      return NextResponse.json({ error: "Admin not found" }, { status: 403 });
    }

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      console.log("[SIMPLE-TEST] Event not found");
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    console.log(`[SIMPLE-TEST] Event found: ${event.name}`);

    // Get all guests with CONFIRMED_PRESENT status
    const attendees = await prisma.guest.findMany({
      where: {
        eventId,
        attendanceStatus: "CONFIRMED_PRESENT",
      },
    });
    console.log(`[SIMPLE-TEST] Found ${attendees.length} confirmed attendees`);

    if (attendees.length === 0) {
      console.log(`[SIMPLE-TEST] No confirmed attendees`);
      return NextResponse.json({ error: "No confirmed attendees found" }, { status: 400 });
    }

    // Get thank you template
    const thankYouTemplate = await prisma.emailTemplate.findFirst({
      where: {
        eventId,
        type: "THANK_YOU",
      },
      orderBy: { isDefault: "desc" },
    });
    console.log(`[SIMPLE-TEST] Template search result:`, thankYouTemplate ? `Found: ${thankYouTemplate.name}` : "NOT FOUND");

    if (!thankYouTemplate) {
      console.log(`[SIMPLE-TEST] No THANK_YOU template`);
      return NextResponse.json({ error: "No THANK_YOU template found" }, { status: 400 });
    }

    let sent = 0;
    const errors: string[] = [];
    const now = new Date();

    for (const guest of attendees) {
      try {
        console.log(`[SIMPLE-TEST] Processing: ${guest.fullName} (${guest.email})`);

        // Build email variables (NO feedbackUrl to keep it simple)
        const vars: Record<string, string> = {
          guestName: guest.fullName,
          salutation: guest.salutation ?? "",
          eventName: event.name,
          eventDate: formatDate(event.date),
          eventTime: formatDateTime(event.startTime),
          venue: event.venue,
          rsvpDeadline: formatDateTime(event.rsvpDeadline),
          acceptUrl: "",
          declineUrl: "",
          feedbackUrl: "[FEEDBACK_URL_PLACEHOLDER]", // Placeholder for now
        };

        const subject = interpolateTemplate(thankYouTemplate.subject, vars);
        const bodyText = interpolateTemplate(thankYouTemplate.plainBody, vars);

        console.log(`[SIMPLE-TEST] Subject: ${subject}`);
        console.log(`[SIMPLE-TEST] Body preview: ${bodyText.substring(0, 100)}...`);

        // Convert to HTML
        const bodyHtml = bodyText
          .split(/\n\n+/)
          .filter((p) => p.trim())
          .map((p) => `<p style="margin:0 0 14px 0;">${p.replace(/\n/g, "<br>")}</p>`)
          .join("");

        const htmlBody = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${event.name}</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="background: #f8f9fa; border-radius: 8px; padding: 32px;">
    ${bodyHtml}
    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
    <p style="font-size: 12px; color: #999;">
      Thank you for attending ${event.name}.
    </p>
  </div>
</body>
</html>`;

        console.log(`[SIMPLE-TEST] Sending email to ${guest.email}`);
        console.log(`[SIMPLE-TEST] From: ${thankYouTemplate.senderName} <${process.env.EMAIL_FROM}>`);
        console.log(`[SIMPLE-TEST] ReplyTo: ${thankYouTemplate.replyTo}`);

        const result = await sendEmail({
          to: guest.email,
          subject,
          htmlBody,
          from: `${thankYouTemplate.senderName} <${process.env.EMAIL_FROM}>`,
          replyTo: thankYouTemplate.replyTo,
        });

        console.log(`[SIMPLE-TEST] SendEmail result:`, result);

        if (result.success) {
          console.log(`[SIMPLE-TEST] ✅ Email sent successfully`);
          
          // Log email
          await prisma.emailLog.create({
            data: {
              guestId: guest.id,
              type: "POST_EVENT_THANK_YOU",
              recipient: guest.email,
              subject,
              sentAt: now,
            },
          });

          sent++;
        } else {
          console.log(`[SIMPLE-TEST] ❌ Email failed: ${result.error}`);
          errors.push(`${guest.email}: ${result.error}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[SIMPLE-TEST] Exception for ${guest.fullName}:`, err);
        errors.push(`${guest.fullName}: ${msg}`);
      }
    }

    console.log(`[SIMPLE-TEST] DONE: sent=${sent}/${attendees.length}`);

    return NextResponse.json({
      success: true,
      sent,
      total: attendees.length,
      message: `Sent ${sent}/${attendees.length} thank you emails`,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error("[SIMPLE-TEST] Outer error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
