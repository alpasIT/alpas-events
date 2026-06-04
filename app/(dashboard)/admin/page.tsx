import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AdminClient } from "@/components/admin-client";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const currentAdmin = await prisma.adminUser.findUnique({
    where: { email: user.email! },
    select: { role: true },
  });

  if (currentAdmin?.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  const admins = await prisma.adminUser.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      mfaEnabled: true,
      lastLogin: true,
      createdAt: true,
    },
  });

  const serialized = admins.map((a) => ({
    ...a,
    lastLogin: a.lastLogin?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Users</h1>
        <p className="text-muted-foreground text-sm">Manage admin accounts and roles</p>
      </div>
      <AdminClient admins={serialized} currentUserEmail={user.email!} />
    </div>
  );
}
