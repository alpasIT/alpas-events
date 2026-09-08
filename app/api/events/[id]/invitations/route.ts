import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { generateToken, formatDate, formatDateTime } from "@/lib/utils";
import {
  sendEmail,
  buildInvitationEmail,
  buildDefaultInvitationHtml,
} from "@/lib/email";
import { buildRsvpUrl, uploadQRCodeAndGetUrl } from "@/lib/qr";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  try {
    const invitations = await prisma.invitation.findMany({
      where: { eventId: id },
      orderBy: { createdAt: "desc" },
      include: { guest: { select: { fullName: true, email: true, category: true } } },
    });
    return NextResponse.json(invitations);
  } catch {
    return NextResponse.json({ error: "Failed to fetch invitations" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAdmin(["SUPER_ADMIN", "EVENT_COORDINATOR"]);
  if (auth.response) return auth.response;

  const { id: eventId } = await params;

  try {
    const admin = auth.admin;

    const body = await request.json();
    const { guestIds } = body as { guestIds: string[] };

    if (!Array.isArray(guestIds) || guestIds.length === 0) {
      return NextResponse.json({ error: "guestIds is required" }, { status: 400 });
    }

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    if (event.date < new Date()) {
      return NextResponse.json({ error: "Cannot send invitations for past events" }, { status: 400 });
    }

    const guests = await prisma.guest.findMany({
      where: { id: { in: guestIds }, eventId },
    });

    // Get invitation template — prefer the default, fall back to any INVITATION template
    const defaultTemplate = await prisma.emailTemplate.findFirst({
      where: { eventId, type: "INVITATION" },
      orderBy: { isDefault: "desc" },
    });

    let sent = 0;

    for (const guest of guests) {
      const token = generateToken(48);
      const rsvpUrl = buildRsvpUrl(token);
      const qrCodeUrl = guest.qrToken
        ? await uploadQRCodeAndGetUrl(guest.qrToken)
        : undefined;

      const invitationData = {
        guestName: guest.fullName,
        salutation: guest.salutation ?? undefined,
        eventName: event.name,
        eventDate: formatDate(event.date),
        eventTime: formatDateTime(event.startTime),
        venue: event.venue,
        rsvpDeadline: formatDateTime(event.rsvpDeadline),
        acceptUrl: `${rsvpUrl}?action=accept`,
        declineUrl: `${rsvpUrl}?action=decline`,
        qrCodeUrl,
      };

      let subject: string;
      let htmlBody: string;

      if (defaultTemplate) {
        const built = buildInvitationEmail(
          defaultTemplate,
          defaultTemplate.subject,
          invitationData
        );
        subject = built.subject;
        htmlBody = built.html;
      } else {
        subject = `You're invited to ${event.name}`;
        htmlBody = buildDefaultInvitationHtml(invitationData);
      }

      // Create invitation record
      const invitation = await prisma.invitation.upsert({
        where: { token },
        create: {
          eventId,
          guestId: guest.id,
          method: guest.invitationMethod,
          token,
          tokenExpiresAt: event.rsvpDeadline,
        },
        update: {},
      });

      // Send email
      const result = await sendEmail({
        to: guest.email,
        subject,
        htmlBody,
        from: defaultTemplate
          ? `${defaultTemplate.senderName} <${process.env.EMAIL_FROM}>`
          : undefined,
        replyTo: defaultTemplate?.replyTo,
      });

      const now = new Date();

      if (result.success) {
        await Promise.all([
          prisma.invitation.update({
            where: { id: invitation.id },
            data: { sentAt: now, deliveredAt: now },
          }),
          prisma.guest.update({
            where: { id: guest.id },
            data: { rsvpStatus: "SENT" },
          }),
          prisma.emailLog.create({
            data: {
              guestId: guest.id,
              type: "INVITATION_SENT",
              recipient: guest.email,
              subject,
              sentAt: now,
            },
          }),
          prisma.activityLog.create({
            data: {
              eventId,
              type: "INVITATION_SENT",
              description: `Invitation sent to ${guest.fullName}`,
              guestId: guest.id,
              adminId: admin.id,
            },
          }),
        ]);
        sent++;
      } else {
        await prisma.invitation.update({
          where: { id: invitation.id },
          data: { failedAt: now, failureReason: result.error },
        });
      }
    }

    return NextResponse.json({ sent, total: guests.length });
  } catch {
    return NextResponse.json({ error: "Failed to send invitations" }, { status: 500 });
  }
}
