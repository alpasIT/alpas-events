#!/usr/bin/env node
// Usage: node scripts/create-admin.js <email> <name> <password> [role]
// Role options: SUPER_ADMIN, EVENT_COORDINATOR, VIEWER, STAFF (default: SUPER_ADMIN)

require("dotenv").config({ path: ".env.local" });

const { createClient } = require("@supabase/supabase-js");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const [, , email, name, password, role = "SUPER_ADMIN"] = process.argv;

if (!email || !name || !password) {
  console.error("Usage: node scripts/create-admin.js <email> <name> <password> [role]");
  process.exit(1);
}

const validRoles = ["SUPER_ADMIN", "EVENT_COORDINATOR", "VIEWER", "STAFF"];
if (!validRoles.includes(role)) {
  console.error(`Invalid role. Choose from: ${validRoles.join(", ")}`);
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;

if (!supabaseUrl || !anonKey) {
  console.error("❌  NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");
  process.exit(1);
}

if (!databaseUrl) {
  console.error("❌  DATABASE_URL is not set in .env.local");
  process.exit(1);
}

async function main() {
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    // 1. Create Supabase auth user
    const hasServiceRole = serviceRoleKey && serviceRoleKey !== "your-service-role-key";

    if (hasServiceRole) {
      // Use admin API — creates user without email confirmation
      const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      console.log(`\nCreating Supabase auth user for ${email} (admin API)...`);
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error && !error.message.includes("already been registered")) {
        throw new Error(`Supabase auth error: ${error.message}`);
      }
      console.log(`✅  Auth user ready`);
    } else {
      // Fall back to signUp — user must confirm email OR you disable confirmation in Supabase
      const supabase = createClient(supabaseUrl, anonKey);
      console.log(`\nCreating Supabase auth user for ${email} (signUp)...`);
      const { error } = await supabase.auth.signUp({ email, password });
      if (error && !error.message.toLowerCase().includes("already registered")) {
        throw new Error(`Supabase signUp error: ${error.message}`);
      }
      console.log(`✅  Auth user created`);
      console.log(`\n⚠️   Email confirmation may be required.`);
      console.log(`    To skip it: Supabase Dashboard → Authentication → Providers → Email → disable "Confirm email"`);
      console.log(`    Or confirm manually: Supabase Dashboard → Authentication → Users → find ${email} → Confirm`);
    }

    // 2. Create admin_users record
    console.log(`\nCreating admin record in database...`);
    const existing = await prisma.adminUser.findUnique({ where: { email } });

    if (existing) {
      console.log(`ℹ️   Admin record already exists (role: ${existing.role})`);
    } else {
      const admin = await prisma.adminUser.create({
        data: { email, name, role, passwordHash: "supabase_auth" },
      });
      console.log(`✅  Admin record created (role: ${admin.role})`);
    }

    console.log(`\n🎉  Done!`);
    console.log(`    URL:      http://localhost:3000/login`);
    console.log(`    Email:    ${email}`);
    console.log(`    Password: ${password}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("❌ ", err.message);
  process.exit(1);
});

