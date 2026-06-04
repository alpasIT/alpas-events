import { NextRequest, NextResponse } from "next/server";
import { generateQRCodeBuffer, buildCheckInUrl } from "@/lib/qr";

interface Params {
  params: Promise<{ token: string }>;
}

export async function GET(_: NextRequest, { params }: Params) {
  const { token } = await params;

  if (!token) {
    return new NextResponse("Missing token", { status: 400 });
  }

  const buffer = await generateQRCodeBuffer(buildCheckInUrl(token));

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
