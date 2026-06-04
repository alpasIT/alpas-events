import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rsvpResponseSchema } from "@/lib/validations";
import { sendEmail } from "@/lib/email";
import { formatDate, formatDateTime } from "@/lib/utils";

interface Params {
  params: Promise<{ token: string }>;
}

export async function GET(_: NextRequest, { params }: Params) {
  const { token } = await params;
  try {
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        guest: { select: { fullName: true, rsvpStatus: true, salutation: true } },
        event: { select: { name: true, date: true, startTime: true, venue: true, rsvpDeadline: true } },
      },
    });

    if (!invitation) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(invitation);
  } catch {
    return NextResponse.json({ error: "Failed to fetch invitation" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const { token } = await params;

  try {
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        guest: true,
        event: true,
      },
    });

    if (!invitation) return NextResponse.json({ error: "Invalid invitation link" }, { status: 404 });

    // Check expiry
    if (invitation.tokenExpiresAt && new Date(invitation.tokenExpiresAt) < new Date()) {
      return NextResponse.json({ error: "This invitation has expired" }, { status: 410 });
    }

    // Check RSVP deadline
    if (new Date(invitation.event.rsvpDeadline) < new Date()) {
      return NextResponse.json({ error: "RSVP deadline has passed" }, { status: 410 });
    }

    const body = await request.json();
    const parsed = rsvpResponseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const { response, declineReason, plusOneNames, dietaryPreference } = parsed.data;
    const now = new Date();

    await prisma.guest.update({
      where: { id: invitation.guestId },
      data: {
        rsvpStatus: response,
        rsvpRespondedAt: now,
        declineReason: declineReason ?? null,
        dietaryPreference: dietaryPreference ?? invitation.guest.dietaryPreference,
        ...(response === "ACCEPTED" && plusOneNames !== undefined
          ? {
              plusOnes: {
                deleteMany: {},
                create: plusOneNames.map((name) => ({ name })),
              },
            }
          : {}),
      },
    });

    await prisma.activityLog.create({
      data: {
        eventId: invitation.eventId,
        type: response === "ACCEPTED" ? "RSVP_ACCEPTED" : "RSVP_DECLINED",
        description: `${invitation.guest.fullName} ${response === "ACCEPTED" ? "accepted" : "declined"} the invitation`,
        guestId: invitation.guestId,
      },
    });

    // Send confirmation email
    const confirmTemplate = await prisma.emailTemplate.findFirst({
      where: {
        eventId: invitation.eventId,
        type: response === "ACCEPTED" ? "ACCEPTANCE_CONFIRMATION" : "DECLINE_ACKNOWLEDGMENT",
        isDefault: true,
      },
    });

    const eventName = invitation.event.name;
    const eventDate = formatDate(invitation.event.date);
    const eventTime = formatDateTime(invitation.event.startTime);
    const venue = invitation.event.venue;

    if (confirmTemplate) {
      const { interpolateTemplate } = await import("@/lib/utils");
      const htmlBody = interpolateTemplate(confirmTemplate.htmlBody, {
        guestName: invitation.guest.fullName,
        salutation: invitation.guest.salutation ?? "",
        eventName,
        eventDate,
        eventTime,
        venue,
        rsvpDeadline: formatDateTime(invitation.event.rsvpDeadline),
        acceptUrl: "",
        declineUrl: "",
      });

      await sendEmail({
        to: invitation.guest.email,
        subject: interpolateTemplate(confirmTemplate.subject, { eventName, guestName: invitation.guest.fullName }),
        htmlBody,
      });
    } else if (response === "ACCEPTED") {
      await sendEmail({
        to: invitation.guest.email,
        subject: `Attendance Confirmed — ${eventName}`,
        htmlBody: `<p>Dear ${invitation.guest.salutation ? invitation.guest.salutation + " " : ""}${invitation.guest.fullName},</p>
          <p>Your attendance at <strong>${eventName}</strong> has been confirmed.</p>
          <p><strong>Date:</strong> ${eventDate}</p>
          <p><strong>Time:</strong> ${eventTime}</p>
          <p><strong>Venue:</strong> ${venue}</p>
          <p>We look forward to seeing you!</p>`,
      });
    }

    return NextResponse.json({ success: true, response });
  } catch {
    return NextResponse.json({ error: "Failed to submit RSVP" }, { status: 500 });
  }
}
