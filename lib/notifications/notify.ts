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

export async function notifyTaskStarted(
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
      type: NotificationType.ЗАДАЧА_В_РАБОТЕ,
      title: "Сотрудник начал работу над задачей",
      body: `${data.employeeName} взял(а) в работу «${data.taskTitle}» в проекте «${data.projectName}»`,
      taskId: data.taskId,
    },
  });
}

export async function notifyPositionChanged(
  db: Db,
  data: {
    userId: string;
    actorId: string;
    position: string;
  },
) {
  await db.notification.create({
    data: {
      userId: data.userId,
      actorId: data.actorId,
      type: NotificationType.ДОЛЖНОСТЬ_ИЗМЕНЕНА,
      title: "Вам назначена новая должность",
      body: `Ваша должность изменена на «${data.position}»`,
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

// ============================================================
// Phase 14 — расширение уведомлений (см. план).
// ============================================================

export async function notifyEmployeeCreated(
  db: Db,
  data: { userId: string; actorId: string; departmentName: string | null },
) {
  await db.notification.create({
    data: {
      userId: data.userId,
      actorId: data.actorId,
      type: NotificationType.СОТРУДНИК_СОЗДАН,
      title: "Добро пожаловать в Tortay Engineering",
      body: data.departmentName
        ? `Для вас создан аккаунт сотрудника в департаменте «${data.departmentName}»`
        : "Для вас создан аккаунт сотрудника",
    },
  });
}

export async function notifyDepartmentAssigned(
  db: Db,
  data: { userId: string; actorId: string; departmentName: string },
) {
  await db.notification.create({
    data: {
      userId: data.userId,
      actorId: data.actorId,
      type: NotificationType.ДЕПАРТАМЕНТ_НАЗНАЧЕН,
      title: "Вас добавили в департамент",
      body: `Вы теперь состоите в департаменте «${data.departmentName}»`,
    },
  });
}

// Срабатывает только при РЕАЛЬНОМ создании новой записи ProjectMember —
// см. lib/projects/membership.ts::ensureProjectMember и
// lib/projects/actions.ts::assignGipAction — не при обновлении роли уже
// существующего участника.
export async function notifyProjectAssigned(
  db: Db,
  data: { userId: string; actorId: string; projectName: string },
) {
  await db.notification.create({
    data: {
      userId: data.userId,
      actorId: data.actorId,
      type: NotificationType.УЧАСТНИК_ПРОЕКТА_ДОБАВЛЕН,
      title: "Вас добавили в проект",
      body: `Вы стали участником проекта «${data.projectName}»`,
    },
  });
}

export async function notifyGipAssigned(
  db: Db,
  data: { userId: string; actorId: string; projectName: string },
) {
  await db.notification.create({
    data: {
      userId: data.userId,
      actorId: data.actorId,
      type: NotificationType.ГИП_НАЗНАЧЕН,
      title: "Вас назначили ГИП",
      body: `Вы назначены главным инженером проекта «${data.projectName}»`,
    },
  });
}

export async function notifyDeadlineChanged(
  db: Db,
  data: { userId: string; actorId: string; taskId: string; taskTitle: string; projectName: string },
) {
  await db.notification.create({
    data: {
      userId: data.userId,
      actorId: data.actorId,
      type: NotificationType.СРОК_ИЗМЕНЁН,
      title: "Изменён срок задачи",
      body: `Срок задачи «${data.taskTitle}» в проекте «${data.projectName}» изменён`,
      taskId: data.taskId,
    },
  });
}

export async function notifyTaskReturned(
  db: Db,
  data: { userId: string; actorId: string; taskId: string; taskTitle: string; projectName: string },
) {
  await db.notification.create({
    data: {
      userId: data.userId,
      actorId: data.actorId,
      type: NotificationType.ЗАДАЧА_ВОЗВРАЩЕНА,
      title: "Задача возвращена на доработку",
      body: `Задача «${data.taskTitle}» в проекте «${data.projectName}» возвращена на доработку`,
      taskId: data.taskId,
    },
  });
}

// ============================================================
// PRD #3 Phase 3 — иерархия "Лид".
// ============================================================

// Получает первого подчинённого — до этого человек был обычным
// сотрудником департамента, теперь у него появляются свои отчёты (см.
// lib/leads/actions.ts::setEmployeeLeadAction — "быть Лидом" это чисто
// производный статус, отдельного флага нет).
export async function notifyLeadPromoted(
  db: Db,
  data: { userId: string; actorId: string; departmentName: string | null },
) {
  await db.notification.create({
    data: {
      userId: data.userId,
      actorId: data.actorId,
      type: NotificationType.ЛИД_НАЗНАЧЕН,
      title: "Вас назначили Лидом",
      body: data.departmentName
        ? `Теперь на вас числятся подчинённые сотрудники в департаменте «${data.departmentName}»`
        : "Теперь на вас числятся подчинённые сотрудники",
    },
  });
}

// Потерял последнего подчинённого (переназначили или сняли) — статус
// Лида исчезает сам по себе, отдельно снимать нечего.
export async function notifyLeadDemoted(db: Db, data: { userId: string; actorId: string }) {
  await db.notification.create({
    data: {
      userId: data.userId,
      actorId: data.actorId,
      type: NotificationType.ЛИД_СНЯТ,
      title: "Вы больше не Лид",
      body: "Все сотрудники, которые подчинялись вам, переназначены — подчинённых больше нет.",
    },
  });
}

export async function notifyTaskApproved(
  db: Db,
  data: { userId: string; actorId: string; taskId: string; taskTitle: string; projectName: string },
) {
  await db.notification.create({
    data: {
      userId: data.userId,
      actorId: data.actorId,
      type: NotificationType.ЗАДАЧА_ОДОБРЕНА,
      title: "Задача одобрена",
      body: `Задача «${data.taskTitle}» в проекте «${data.projectName}» принята выполненной`,
      taskId: data.taskId,
    },
  });
}
