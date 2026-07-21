import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { signOutAction } from "@/lib/actions/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { getCurrentUserRoleTier } from "@/lib/departments/queries";
import { getEmployeeProfile } from "@/lib/employees/queries";
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

  const [notifications, unreadNotificationCount, roleTier, profile] = await Promise.all([
    getNotificationsForCurrentUser(10),
    getUnreadNotificationCount(),
    getCurrentUserRoleTier(session.user),
    // Свежие данные из БД, а не то, что закэшировано в JWT — иначе,
    // например, аватар оставался бы старым до следующего входа
    // (see plan D12: сессия/JWT не обновляются на лету).
    getEmployeeProfile(session.user.id),
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
        profile={profile}
      />
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">{children}</main>
    </div>
  );
}
