import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { z } from "zod";

interface Params {
  params: Promise<{ adminId: string }>;
}

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  adminEmail: z.string().email(),
});

export async function POST(request: NextRequest, { params }: Params) {
  const { adminId } = await params;
  try {
    const auth = await requireAdmin(["SUPER_ADMIN"]);
    if (auth.response) return auth.response;

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
      select: { supabaseId: true, email: true },
    });

    if (!targetAdmin) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    if (!targetAdmin.supabaseId) {
      return NextResponse.json(
        { error: "Admin is not linked to Supabase Auth; cannot reset password" },
        { status: 400 }
      );
    }

    // Hash the new password for database storage
    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);

    // Update password in Supabase Auth using the stored Supabase ID
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!serviceRole || !supabaseUrl) {
      return NextResponse.json({ error: "Service role not configured" }, { status: 500 });
    }

    const adminSupabase = createAdminClient(supabaseUrl, serviceRole, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Update password in Supabase Auth
    const { error: updateError } = await adminSupabase.auth.admin.updateUserById(
      targetAdmin.supabaseId,
      { password: parsed.data.newPassword }
    );

    if (updateError) {
      console.error("Failed to update Supabase auth password:", updateError);
      return NextResponse.json(
        { error: "Failed to update authentication password" },
        { status: 500 }
      );
    }

    // Update the admin's password hash in database
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
