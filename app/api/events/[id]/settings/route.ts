import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

interface Params {
  params: Promise<{ id: string }>;
}

const settingsSchema = z.object({
  enablePlusOne: z.boolean(),
  enableDietaryPreference: z.boolean(),
});

export async function GET(_: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  try {
    const event = await prisma.event.findUnique({
      where: { id },
      select: { enablePlusOne: true, enableDietaryPreference: true },
    });
    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(event);
  } catch {
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  try {
    const body = await request.json();
    const parsed = settingsSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const event = await prisma.event.update({
      where: { id },
      data: parsed.data,
      select: { enablePlusOne: true, enableDietaryPreference: true },
    });

    return NextResponse.json(event);
  } catch {
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
