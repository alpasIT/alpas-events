import { getCurrentAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NavSidebar } from "@/components/nav-sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const adminUser = await getCurrentAdmin();

  if (!adminUser) {
    const supabase = await createClient();
    // Drop non-admin Supabase sessions so they cannot sit in the dashboard shell.
    await supabase.auth.signOut();
    redirect("/login?error=not_admin");
  }

  return (
    <div className="min-h-screen bg-background">
      <NavSidebar
        userEmail={adminUser.email}
        userName={adminUser.name}
        userRole={adminUser.role}
      />
      <main className="lg:pl-64">
        <div className="pt-16 lg:pt-0">
          {children}
        </div>
      </main>
    </div>
  );
}
