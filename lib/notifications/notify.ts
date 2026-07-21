// Не "use server" — это внутренние хелперы, вызываемые ТОЛЬКО из других
// server-модулей (lib/tasks/actions.ts) внутри их транзакций, а не
// напрямую с клиента. Аналог lib/activity/log.ts::logActivity.
import type { Prisma, PrismaClient } from "@prisma/client";
import { NotificationType } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export async function notifyTaskAssigned(
  db: Db,
  data: {
    userId: string;
    actorId: string;
    taskId: string;
    taskTitle: string;
    projectName: string;
  },
) {
  await db.notification.create({
    data: {
      userId: data.userId,
      actorId: data.actorId,
      type: NotificationType.ЗАДАЧА_НАЗНАЧЕНА,
      title: "Вам назначена задача",
      body: `«${data.taskTitle}» в проекте «${data.projectName}»`,
      taskId: data.taskId,
    },
  });
}

export async function notifyTaskReadyForReview(
  db: Db,
  data: {
    userId: string;
    actorId: string;
    taskId: string;
    taskTitle: string;
    employeeName: string;
    projectName: string;
  },
) {
  await db.notification.create({
    data: {
      userId: data.userId,
      actorId: data.actorId,
      type: NotificationType.ЗАДАЧА_НА_ПРОВЕРКЕ,
      title: "Задача готова к проверке",
      body: `${data.employeeName} отправил(а) «${data.taskTitle}» на проверку в проекте «${data.projectName}»`,
      taskId: data.taskId,
    },
  });
}
