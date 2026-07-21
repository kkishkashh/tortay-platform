import { PageHeader } from "@/components/layout/page-header";
import { getNotificationsForCurrentUser } from "@/lib/notifications/queries";
import { formatTodayLabel } from "@/lib/utils";

import { NotificationsList } from "./notifications-list";

export default async function NotificationsPage() {
  const notifications = await getNotificationsForCurrentUser(100);

  return (
    <>
      <PageHeader title="Уведомления" subtitle={formatTodayLabel(new Date())} />
      <div className="p-8">
        {notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">Уведомлений пока нет.</p>
        ) : (
          <NotificationsList notifications={notifications} />
        )}
      </div>
    </>
  );
}
