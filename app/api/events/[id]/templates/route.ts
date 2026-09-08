import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { emailTemplateSchema } from "@/lib/validations";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  try {
    const templates = await prisma.emailTemplate.findMany({
      where: { eventId: id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(templates);
  } catch {
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAdmin(["SUPER_ADMIN", "EVENT_COORDINATOR"]);
  if (auth.response) return auth.response;

  const { id: eventId } = await params;
  try {
    const body = await request.json();
    const parsed = emailTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    // Auto-set as default if it's the first template of this type
    const existingCount = await prisma.emailTemplate.count({
      where: { eventId, type: parsed.data.type },
    });
    const shouldBeDefault = parsed.data.isDefault || existingCount === 0;

    if (shouldBeDefault) {
      await prisma.emailTemplate.updateMany({
        where: { eventId, type: parsed.data.type, isDefault: true },
        data: { isDefault: false },
      });
    }

    const template = await prisma.emailTemplate.create({
      data: { ...parsed.data, isDefault: shouldBeDefault, eventId },
    });

    return NextResponse.json(template, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
  }
}
