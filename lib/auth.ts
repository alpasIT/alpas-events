import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import type { AdminRole, AdminUser } from "@prisma/client";

export async function getCurrentAdmin(): Promise<AdminUser | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  return prisma.adminUser.findUnique({ where: { email: user.email } });
}

type RequireAdminResult =
  | { admin: AdminUser; response?: undefined }
  | { admin?: undefined; response: NextResponse };

/**
 * Verifies the caller is a registered AdminUser (not just any Supabase session),
 * since Prisma bypasses Supabase RLS and this is the sole authorization boundary.
 */
export async function requireAdmin(allowedRoles?: AdminRole[]): Promise<RequireAdminResult> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (allowedRoles && !allowedRoles.includes(admin.role)) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { admin };
}
