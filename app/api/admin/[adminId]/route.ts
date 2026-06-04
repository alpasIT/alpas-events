import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
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

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["SUPER_ADMIN", "EVENT_COORDINATOR", "VIEWER", "STAFF"]).optional(),
});

export async function PATCH(request: NextRequest, { params }: Params) {
  const { adminId } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!await requireSuperAdmin(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const admin = await prisma.adminUser.update({
      where: { id: adminId },
      data: parsed.data,
    });

    return NextResponse.json(admin);
  } catch {
    return NextResponse.json({ error: "Failed to update admin" }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { adminId } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!await requireSuperAdmin(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const target = await prisma.adminUser.findUnique({ where: { id: adminId } });
    if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Prevent self-deletion
    if (target.email === user!.email) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
    }

    // Delete Supabase auth user
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (serviceRole && supabaseUrl) {
      const adminSupabase = createAdminClient(supabaseUrl, serviceRole, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data: authUsers } = await adminSupabase.auth.admin.listUsers();
      const authUser = authUsers?.users.find((u) => u.email === target.email);
      if (authUser) {
        await adminSupabase.auth.admin.deleteUser(authUser.id);
      }
    }

    await prisma.adminUser.delete({ where: { id: adminId } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete admin" }, { status: 500 });
  }
}
