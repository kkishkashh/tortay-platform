import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { signOutAction } from "@/lib/actions/auth";
import { Sidebar } from "@/components/layout/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // proxy.ts уже блокирует неавторизованных, это подстраховка на случай
  // изменения matcher-конфига в будущем.
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        fullName={session.user.name ?? session.user.email ?? ""}
        systemRoleLabel={session.user.systemRole}
        onSignOut={signOutAction}
      />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
