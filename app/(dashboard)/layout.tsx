import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { signOutAction } from "@/lib/actions/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { getCurrentUserRoleTier } from "@/lib/departments/queries";
import {
  getNotificationsForCurrentUser,
  getUnreadNotificationCount,
} from "@/lib/notifications/queries";

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

  const [notifications, unreadNotificationCount, roleTier] = await Promise.all([
    getNotificationsForCurrentUser(10),
    getUnreadNotificationCount(),
    getCurrentUserRoleTier(session.user),
  ]);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        fullName={session.user.name ?? session.user.email ?? ""}
        systemRoleLabel={session.user.systemRole}
        roleTier={roleTier}
        onSignOut={signOutAction}
        notifications={notifications}
        unreadNotificationCount={unreadNotificationCount}
      />
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">{children}</main>
    </div>
  );
}
