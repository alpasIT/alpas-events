import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { formatDate, formatDateTime, interpolateTemplate, generateToken } from "@/lib/utils";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(_: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const admin = auth.admin;

  const { id: eventId } = await params;

  try {
    console.log(`[SendThankYou] Starting for event: ${eventId}`);

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      console.log("[SendThankYou] Event not found");
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    console.log(`[SendThankYou] Event found: ${event.name}`);

    // Get all guests with CONFIRMED_PRESENT status
    const attendees = await prisma.guest.findMany({
      where: {
        eventId,
        attendanceStatus: "CONFIRMED_PRESENT",
      },
    });

    console.log(`[SendThankYou] Found ${attendees.length} attendees with CONFIRMED_PRESENT status`);

    if (attendees.length === 0) {
      console.log(`[SendThankYou] No confirmed attendees found`);
      return NextResponse.json({ error: "No confirmed attendees found" }, { status: 400 });
    }

    // Get thank you template - must exist
    const thankYouTemplate = await prisma.emailTemplate.findFirst({
      where: {
        eventId,
        type: "THANK_YOU",
      },
      orderBy: { isDefault: "desc" },
    });

    console.log(`[SendThankYou] Template search result:`, thankYouTemplate ? `Found: ${thankYouTemplate.name}` : "NOT FOUND");

    if (!thankYouTemplate) {
      console.log(`[SendThankYou] No THANK_YOU template found for event ${eventId}`);
      return NextResponse.json({ error: "No THANK_YOU template found. Please create one first." }, { status: 400 });
    }

    let sent = 0;
    const now = new Date();
    const errors: string[] = [];

    console.log(`[SendThankYou] Processing ${attendees.length} confirmed attendees for event ${eventId}`);
    console.log(`[SendThankYou] Thank you template found: ${thankYouTemplate?.name}`);

    for (const guest of attendees) {
      try {
        const feedbackToken = generateToken();
        const feedbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/feedback/${feedbackToken}`;

        console.log(`[SendThankYou] Processing guest: ${guest.fullName} (${guest.email})`);

        // Try to create feedback record, but don't fail the email if it doesn't work
        try {
          console.log(`[SendThankYou] Attempting to create feedback record...`);
          let feedback = await prisma.eventFeedback.findFirst({
            where: { eventId, guestId: guest.id },
          });

          if (feedback) {
            console.log(`[SendThankYou] Updating existing feedback`);
            await prisma.eventFeedback.update({
              where: { id: feedback.id },
              data: { token: feedbackToken, rating: 0, submittedAt: null },
            });
          } else {
            console.log(`[SendThankYou] Creating new feedback`);
            await prisma.eventFeedback.create({
              data: { eventId, guestId: guest.id, token: feedbackToken, rating: 0 },
            });
          }
          console.log(`[SendThankYou] ✅ Feedback record OK`);
        } catch (feedbackErr) {
          console.warn(`[SendThankYou] ⚠️  Feedback record failed (proceeding anyway):`, feedbackErr instanceof Error ? feedbackErr.message : String(feedbackErr));
          // Continue - still send email even if feedback fails
        }

        // Build email content using template
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
          feedbackUrl,
        };

        const subject = interpolateTemplate(thankYouTemplate.subject, vars);
        const bodyText = interpolateTemplate(thankYouTemplate.plainBody, vars);
        
        console.log(`[SendThankYou] Email subject for ${guest.email}: ${subject}`);

        // Convert plain text to HTML
        const imagesHtml = (thankYouTemplate.imageUrls ?? [])
          .map((url) => `<img src="${url}" alt="" style="max-width:100%;display:block;margin:16px auto;">`)
          .join("");

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
    ${imagesHtml}
    ${bodyHtml}
    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
    <p style="font-size: 12px; color: #999;">
      Thank you for attending ${event.name}.
    </p>
  </div>
</body>
</html>`;

        console.log(`[SendThankYou] Attempting to send email to ${guest.email}`);
        console.log(`[SendThankYou] Email from: ${thankYouTemplate.senderName} <${process.env.EMAIL_FROM}>`);
        console.log(`[SendThankYou] Email subject: ${subject}`);
        console.log(`[SendThankYou] Body preview: ${bodyText.substring(0, 100)}...`);
        console.log(`[SendThankYou] Feedback URL: ${feedbackUrl}`);

        // Send email
        const result = await sendEmail({
          to: guest.email,
          subject,
          htmlBody,
          from: `${thankYouTemplate.senderName} <${process.env.EMAIL_FROM}>`,
          replyTo: thankYouTemplate.replyTo,
        });

        console.log(`[SendThankYou] SendEmail returned:`, JSON.stringify(result));

        if (result.success) {
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

          // Log activity
          await prisma.activityLog.create({
            data: {
              eventId,
              type: "INVITATION_SENT",
              description: `Thank you email sent to ${guest.fullName}`,
              guestId: guest.id,
              adminId: admin.id,
            },
          });

          sent++;
        } else {
          errors.push(`${guest.email}: ${result.error || "Unknown error"}`);
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[SendThankYou] Outer catch for ${guest.fullName}:`, err);
        errors.push(`${guest.fullName}: ${errMsg}`);
        // Continue with next guest
      }
    }

    console.log(`[SendThankYou] Summary: sent=${sent}, total=${attendees.length}, errors=${errors.length}`);
    if (errors.length > 0) {
      console.log(`[SendThankYou] Errors:`, errors);
    }

    return NextResponse.json({
      success: true,
      sent,
      total: attendees.length,
      message: `Sent ${sent} thank you email(s) to confirmed attendees`,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error("Error sending thank you emails:", err);
    return NextResponse.json(
      { error: "Failed to send thank you emails" },
      { status: 500 }
    );
  }
}
