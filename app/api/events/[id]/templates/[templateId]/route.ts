import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { emailTemplateSchema } from "@/lib/validations";

interface Params {
  params: Promise<{ id: string; templateId: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id: eventId, templateId } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = emailTemplateSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    if (parsed.data.isDefault) {
      // Look up this template's type if not provided in body
      const type = parsed.data.type ?? (await prisma.emailTemplate.findUnique({
        where: { id: templateId },
        select: { type: true },
      }))?.type;
      if (type) {
        await prisma.emailTemplate.updateMany({
          where: { eventId, type, isDefault: true, id: { not: templateId } },
          data: { isDefault: false },
        });
      }
    }

    const template = await prisma.emailTemplate.update({
      where: { id: templateId },
      data: parsed.data,
    });

    return NextResponse.json(template);
  } catch {
    return NextResponse.json({ error: "Failed to update template" }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { templateId } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await prisma.emailTemplate.delete({ where: { id: templateId } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 });
  }
}
