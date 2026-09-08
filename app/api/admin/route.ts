import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { adminUserSchema } from "@/lib/validations";

const SAFE_ADMIN_SELECT = {
  id: true,
  supabaseId: true,
  name: true,
  email: true,
  role: true,
  mfaEnabled: true,
  createdAt: true,
  updatedAt: true,
  lastLogin: true,
} as const;

export async function GET() {
  try {
    const auth = await requireAdmin(["SUPER_ADMIN"]);
    if (auth.response) return auth.response;

    const admins = await prisma.adminUser.findMany({
      orderBy: { createdAt: "desc" },
      select: SAFE_ADMIN_SELECT,
    });
    return NextResponse.json(admins);
  } catch {
    return NextResponse.json({ error: "Failed to fetch admins" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(["SUPER_ADMIN"]);
    if (auth.response) return auth.response;

    const body = await request.json();
    const parsed = adminUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const { name, email, password, role } = parsed.data;

    // Create Supabase Auth user with service role
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!serviceRole || !supabaseUrl) {
      return NextResponse.json({ error: "Service role not configured" }, { status: 500 });
    }

    const adminSupabase = createAdminClient(supabaseUrl, serviceRole, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    // passwordHash is managed by Supabase Auth; store a sentinel value in Prisma
    const admin = await prisma.adminUser.create({
      data: {
        supabaseId: authData.user.id,
        name,
        email,
        role,
        passwordHash: "supabase_auth",
      },
      select: SAFE_ADMIN_SELECT,
    });

    return NextResponse.json(admin, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create admin" }, { status: 500 });
  }
}
