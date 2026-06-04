import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { NavSidebar } from "@/components/nav-sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: { email: user.email! },
    select: { name: true, role: true, email: true },
  });

  return (
    <div className="min-h-screen bg-background">
      <NavSidebar
        userEmail={adminUser?.email ?? user.email}
        userName={adminUser?.name}
        userRole={adminUser?.role}
      />
      <main className="lg:pl-64">
        <div className="pt-16 lg:pt-0">
          {children}
        </div>
      </main>
    </div>
  );
}
