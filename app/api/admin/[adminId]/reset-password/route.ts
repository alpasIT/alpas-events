import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

interface Params {
  params: Promise<{ adminId: string }>;
}

async function requireSuperAdmin(user: { email?: string } | null) {
  if (!user?.email) return null;
  const admin = await prisma.adminUser.findUnique({ where: { email: user.email } });
  if (!admin || admin.role !== "SUPER_ADMIN") return null;
  return admin;
}

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  adminEmail: z.string().email(),
});

export async function POST(request: NextRequest, { params }: Params) {
  const { adminId } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!await requireSuperAdmin(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const targetAdmin = await prisma.adminUser.findUnique({
      where: { id: adminId },
    });

    if (!targetAdmin) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);

    // Update the admin's password
    const updated = await prisma.adminUser.update({
      where: { id: adminId },
      data: { passwordHash },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        lastLogin: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Password reset for ${targetAdmin.email}`,
      admin: updated,
    });
  } catch (err) {
    console.error("Password reset error:", err);
    return NextResponse.json(
      { error: "Failed to reset password" },
      { status: 500 }
    );
  }
}
