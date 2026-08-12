import { NextRequest, NextResponse } from "next/server";
import { generateQRCodeBuffer, buildCheckInUrl } from "@/lib/qr";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

interface Params {
  params: Promise<{ token: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const { token } = await params;

  if (!token) {
    return new NextResponse("Missing token", { status: 400 });
  }

  if (!checkRateLimit(`qr:${getClientIp(request)}`, 60, 60_000)) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  const buffer = await generateQRCodeBuffer(buildCheckInUrl(token));

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
