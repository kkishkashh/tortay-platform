import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function getUnreadNotificationCount() {
  const session = await auth();
  if (!session?.user) return 0;

  return prisma.notification.count({
    where: { userId: session.user.id, isRead: false },
  });
}

export type NotificationListItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: Date;
  taskId: string | null;
  projectId: string | null;
  actorName: string | null;
};

export async function getNotificationsForCurrentUser(limit = 20): Promise<NotificationListItem[]> {
  const session = await auth();
  if (!session?.user) return [];

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    include: {
      actor: { select: { fullName: true } },
      task: { select: { section: { select: { projectId: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return notifications.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    isRead: n.isRead,
    createdAt: n.createdAt,
    taskId: n.taskId,
    projectId: n.task?.section.projectId ?? null,
    actorName: n.actor?.fullName ?? null,
  }));
}
