import QRCode from "qrcode";
import { createClient } from "@supabase/supabase-js";

export async function generateQRCodeDataURL(data: string): Promise<string> {
  return QRCode.toDataURL(data, {
    width: 300,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });
}

export async function generateQRCodeBuffer(data: string): Promise<Buffer> {
  return QRCode.toBuffer(data, {
    width: 300,
    margin: 2,
  });
}

export function buildCheckInUrl(qrToken: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${appUrl}/check-in?token=${qrToken}`;
}

export function buildRsvpUrl(token: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${appUrl}/rsvp/${token}`;
}

/**
 * Generates a QR code for the given token, uploads it to Supabase Storage,
 * and returns the permanent public URL. This URL is accessible by any email client.
 */
export async function uploadQRCodeAndGetUrl(qrToken: string): Promise<string | undefined> {
  try {
    const buffer = await generateQRCodeBuffer(buildCheckInUrl(qrToken));
    const path = `qr-codes/${qrToken}.png`;

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await admin.storage.from("email-assets").upload(path, buffer, {
      contentType: "image/png",
      cacheControl: "31536000",
      upsert: true,
    });

    if (error) {
      console.error("[QR upload] Storage upload failed:", error.message);
      return undefined;
    }

    const { data } = admin.storage.from("email-assets").getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.error("[QR upload] Unexpected error:", err instanceof Error ? err.message : err);
    return undefined;
  }
}
