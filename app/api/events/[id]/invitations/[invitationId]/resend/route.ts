import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/utils";
import { sendEmail, buildInvitationEmail, buildDefaultInvitationHtml } from "@/lib/email";
import { buildRsvpUrl, uploadQRCodeAndGetUrl } from "@/lib/qr";

interface Params {
  params: Promise<{ id: string; invitationId: string }>;
}

export async function POST(_: NextRequest, { params }: Params) {
  const auth = await requireAdmin(["SUPER_ADMIN", "EVENT_COORDINATOR"]);
  if (auth.response) return auth.response;

  const { id: eventId, invitationId } = await params;

  try {
    const admin = auth.admin;

    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
      include: {
        guest: true,
        event: true,
      },
    });

    if (!invitation) return NextResponse.json({ error: "Invitation not found" }, { status: 404 });

    const { guest, event } = invitation;

    if (event.date < new Date()) {
      return NextResponse.json({ error: "Cannot resend invitations for past events" }, { status: 400 });
    }

    const defaultTemplate = await prisma.emailTemplate.findFirst({
      where: { eventId, type: "INVITATION" },
      orderBy: { isDefault: "desc" },
    });

    const rsvpUrl = buildRsvpUrl(invitation.token);
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
      const built = buildInvitationEmail(defaultTemplate, defaultTemplate.subject, invitationData);
      subject = built.subject;
      htmlBody = built.html;
    } else {
      subject = `You're invited to ${event.name}`;
      htmlBody = buildDefaultInvitationHtml(invitationData);
    }

    const result = await sendEmail({ to: guest.email, subject, htmlBody });

    const now = new Date();

    await Promise.all([
      prisma.invitation.update({
        where: { id: invitationId },
        data: {
          resendCount: { increment: 1 },
          lastResentAt: now,
          sentAt: invitation.sentAt ?? now,
        },
      }),
      prisma.activityLog.create({
        data: {
          eventId,
          type: "INVITATION_RESENT",
          description: `Invitation resent to ${guest.fullName}`,
          guestId: guest.id,
          adminId: admin.id,
        },
      }),
    ]);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to resend invitation" }, { status: 500 });
  }
}
