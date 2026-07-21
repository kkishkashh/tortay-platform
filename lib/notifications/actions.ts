"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Пользователь может отмечать прочитанными только СВОИ уведомления —
// проверка через where: { userId } в самом запросе, а не отдельным
// permission-модулем (действие слишком узкое, чтобы заводить под него
// файл вроде lib/tasks/permissions.ts).
export async function markNotificationReadAction(notificationId: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  await prisma.notification.updateMany({
    where: { id: notificationId, userId: session.user.id },
    data: { isRead: true },
  });

  revalidatePath("/notifications");
}

export async function markAllNotificationsReadAction() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  await prisma.notification.updateMany({
    where: { userId: session.user.id, isRead: false },
    data: { isRead: true },
  });

  revalidatePath("/notifications");
}
