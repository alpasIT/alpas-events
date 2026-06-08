import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { adminUserSchema } from "@/lib/validations";

async function requireSuperAdmin(user: { email?: string } | null) {
  if (!user?.email) return null;
  const admin = await prisma.adminUser.findUnique({ where: { email: user.email } });
  if (!admin || admin.role !== "SUPER_ADMIN") return null;
  return admin;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!await requireSuperAdmin(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admins = await prisma.adminUser.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(admins);
  } catch {
    return NextResponse.json({ error: "Failed to fetch admins" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!await requireSuperAdmin(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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
        passwordHash: "supabase_auth" 
      },
    });

    return NextResponse.json(admin, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create admin" }, { status: 500 });
  }
}
