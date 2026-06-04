import { Resend } from "resend";
import { interpolateTemplate } from "./utils";

const resend = new Resend(process.env.RESEND_API_KEY);

const DEFAULT_FROM = `${process.env.EMAIL_FROM_NAME ?? "Event Registration"} <${process.env.EMAIL_FROM ?? "noreply@example.com"}>`;

export interface SendEmailOptions {
  to: string;
  subject: string;
  htmlBody: string;
  plainBody?: string;
  from?: string;
  replyTo?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
  try {
    await resend.emails.send({
      from: options.from ?? DEFAULT_FROM,
      to: options.to,
      subject: options.subject,
      html: options.htmlBody,
      text: options.plainBody,
      replyTo: options.replyTo,
    });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send email";
    return { success: false, error: message };
  }
}

export interface InvitationEmailData {
  guestName: string;
  salutation?: string;
  eventName: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  rsvpDeadline: string;
  acceptUrl: string;
  declineUrl: string;
  qrCodeUrl?: string;
}

export function plainTextToHtml(text: string, imageUrls: string[] = []): string {
  const imagesHtml = imageUrls
    .map((url) => `<img src="${url}" alt="" style="max-width:100%;display:block;margin:16px auto;">`)
    .join("");

  const bodyHtml = text
    .split(/\n\n+/)
    .filter((p) => p.trim())
    .map((p) => `<p style="margin:0 0 12px 0;">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">${imagesHtml}${bodyHtml}</body></html>`;
}

export function buildInvitationEmail(
  template: { htmlBody?: string | null; plainBody: string; imageUrls?: string[] },
  templateSubject: string,
  data: InvitationEmailData
): { subject: string; html: string } {
  const vars: Record<string, string> = {
    guestName: data.guestName,
    salutation: data.salutation ?? "",
    eventName: data.eventName,
    eventDate: data.eventDate,
    eventTime: data.eventTime,
    venue: data.venue,
    rsvpDeadline: data.rsvpDeadline,
    acceptUrl: data.acceptUrl,
    declineUrl: data.declineUrl,
    qrCodeUrl: data.qrCodeUrl ?? "",
  };

  const subject = interpolateTemplate(templateSubject, vars);

  // If a fully custom HTML body exists, use it as-is (with variable interpolation only)
  if (template.htmlBody) {
    return { subject, html: interpolateTemplate(template.htmlBody, vars) };
  }

  // Build the message section from the plain body (with variable interpolation)
  const interpolatedBody = interpolateTemplate(template.plainBody, vars);
  const imagesHtml = (template.imageUrls ?? [])
    .map((url) => `<img src="${url}" alt="" style="max-width:100%;display:block;margin:16px auto;">`)
    .join("");
  const bodyHtml = interpolatedBody
    .split(/\n\n+/)
    .filter((p) => p.trim())
    .map((p) => `<p style="margin:0 0 14px 0;">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.eventName}</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="background: #f8f9fa; border-radius: 8px; padding: 32px;">
    <h2 style="color: #16213e; margin-top: 0;">${data.eventName}</h2>

    <div style="background: white; border-radius: 6px; padding: 20px; margin-bottom: 24px;">
      <p style="margin: 6px 0;"><strong>📅 Date:</strong> ${data.eventDate}</p>
      <p style="margin: 6px 0;"><strong>🕐 Time:</strong> ${data.eventTime}</p>
      <p style="margin: 6px 0;"><strong>📍 Venue:</strong> ${data.venue}</p>
      <p style="margin: 6px 0;"><strong>⏰ RSVP by:</strong> ${data.rsvpDeadline}</p>
    </div>

    ${imagesHtml}
    ${bodyHtml}

    <div style="text-align: center; margin: 32px 0;">
      <a href="${data.acceptUrl}" style="background: #10b981; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 0 8px; display: inline-block;">
        ✓ Accept Invitation
      </a>
      <a href="${data.declineUrl}" style="background: #ef4444; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 0 8px; display: inline-block;">
        ✗ Decline
      </a>
    </div>

    ${data.qrCodeUrl ? `
    <div style="text-align: center; margin: 32px 0; padding: 20px; background: white; border-radius: 6px;">
      <p style="color: #444; font-size: 15px; font-weight: bold; margin-bottom: 12px;">Your Entry QR Code</p>
      <p style="color: #666; font-size: 13px; margin-bottom: 16px;">If you accept, please present this QR code at the venue entrance.</p>
      <img src="${data.qrCodeUrl}" alt="Check-in QR Code" style="width: 220px; height: 220px; display: block; margin: 0 auto;">
      <p style="color: #888; font-size: 12px; margin-top: 10px;">Scan this code at the venue entrance</p>
    </div>` : ""}

    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
    <p style="font-size: 12px; color: #999;">
      This invitation was sent to ${data.guestName}. If you received this in error, please disregard.
    </p>
  </div>
</body>
</html>`;

  return { subject, html };
}

export function buildDefaultInvitationHtml(data: InvitationEmailData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="background: #f8f9fa; border-radius: 8px; padding: 32px;">
    <h1 style="color: #1a1a2e; margin-bottom: 8px;">You're Invited!</h1>
    <h2 style="color: #16213e; margin-top: 0;">${data.eventName}</h2>

    <div style="background: white; border-radius: 6px; padding: 20px; margin: 24px 0;">
      <p style="margin: 8px 0;"><strong>📅 Date:</strong> ${data.eventDate}</p>
      <p style="margin: 8px 0;"><strong>🕐 Time:</strong> ${data.eventTime}</p>
      <p style="margin: 8px 0;"><strong>📍 Venue:</strong> ${data.venue}</p>
      <p style="margin: 8px 0;"><strong>⏰ RSVP by:</strong> ${data.rsvpDeadline}</p>
    </div>

    <p>Dear ${data.salutation ? data.salutation + " " : ""}${data.guestName},</p>
    <p>We would be honored by your presence. Please present the QR code below upon arrival for check-in.</p>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${data.acceptUrl}" style="background: #10b981; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 0 8px; display: inline-block;">
        ✓ Accept Invitation
      </a>
      <a href="${data.declineUrl}" style="background: #ef4444; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 0 8px; display: inline-block;">
        ✗ Decline
      </a>
    </div>

    ${data.qrCodeUrl ? `
    <div style="text-align: center; margin: 32px 0; padding: 20px; background: white; border-radius: 6px;">
      <p style="color: #444; font-size: 15px; font-weight: bold; margin-bottom: 12px;">Your Entry QR Code</p>
      <p style="color: #666; font-size: 13px; margin-bottom: 16px;">If you accept, please present this QR code at the venue entrance.</p>
      <img src="${data.qrCodeUrl}" alt="Check-in QR Code" style="width: 220px; height: 220px; display: block; margin: 0 auto;">
      <p style="color: #888; font-size: 12px; margin-top: 10px;">Scan this code at the venue entrance</p>
    </div>` : ""}

    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
    <p style="font-size: 12px; color: #999;">
      This invitation was sent to ${data.guestName}. If you received this in error, please disregard.
    </p>
  </div>
</body>
</html>`;
}
