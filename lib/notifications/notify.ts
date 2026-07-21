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

// Уведомление для САМОГО нового руководителя — увидит его, как только
// впервые войдёт (учётные данные приходят отдельно письмом, см.
// sendManagerCreatedEmail).
export async function notifyManagerCreated(
  db: Db,
  data: { userId: string; actorId: string; departmentName: string | null },
) {
  await db.notification.create({
    data: {
      userId: data.userId,
      actorId: data.actorId,
      type: NotificationType.МЕНЕДЖЕР_СОЗДАН,
      title: "Вас назначили руководителем",
      body: data.departmentName
        ? `Вам создан аккаунт руководителя департамента «${data.departmentName}»`
        : "Вам создан аккаунт руководителя — департамент пока не назначен",
    },
  });
}

// Только для АДМИНСКОГО сброса чужого пароля (resetManagerPasswordAction,
// а с Phase 14 — и changePasswordAction для обычных сотрудников).
// Самостоятельная смена пароля этим НЕ пользуется — вызывающая сторона
// сама решает, когда звать эту функцию.
export async function notifyPasswordReset(
  db: Db,
  data: { userId: string; actorId: string },
) {
  await db.notification.create({
    data: {
      userId: data.userId,
      actorId: data.actorId,
      type: NotificationType.ПАРОЛЬ_СБРОШЕН,
      title: "Ваш пароль был сброшен",
      body: "Администратор сбросил пароль вашей учётной записи — уточните новый пароль у него.",
    },
  });
}
