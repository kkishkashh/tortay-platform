"use server";

import { revalidatePath } from "next/cache";
import { SystemRole, TaskPriority, TaskStatus } from "@prisma/client";
import { del } from "@vercel/blob";

import { auth } from "@/auth";
import { logActivity } from "@/lib/activity/log";
import {
  sendDeadlineChangedEmail,
  sendTaskApprovedEmail,
  sendTaskAssignedEmail,
  sendTaskReadyForReviewEmail,
  sendTaskReturnedEmail,
  sendTaskStartedEmail,
} from "@/lib/email/send";
import {
  notifyDeadlineChanged,
  notifyTaskApproved,
  notifyTaskAssigned,
  notifyTaskReadyForReview,
  notifyTaskReturned,
  notifyTaskStarted,
} from "@/lib/notifications/notify";
import { prisma } from "@/lib/prisma";
import { TASK_STATUS_LABELS } from "@/lib/projects/status-labels";
import { canManageProjectTasks, FORWARD_TRANSITIONS } from "@/lib/tasks/permissions";
import { UNASSIGNED_MEMBER_VALUE } from "@/lib/tasks/constants";

const TASK_PRIORITY_VALUES = new Set<string>(Object.values(TaskPriority));
const TASK_STATUS_VALUES = new Set<string>(Object.values(TaskStatus));

async function loadSectionForPermissionCheck(sectionId: string) {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    select: {
      id: true,
      projectId: true,
      project: { select: { name: true } },
      department: { select: { id: true, managerId: true } },
    },
  });
  if (!section) {
    throw new Error("Раздел не найден");
  }
  return section;
}

function parseTaskFields(formData: FormData) {
  const title = (formData.get("title") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim() || null;
  const priorityRaw = (formData.get("priority") as string | null) ?? TaskPriority.СРЕДНИЙ;
  const deadlineRaw = formData.get("deadline") as string | null;
  const assigneeMemberIdRaw = (formData.get("assigneeMemberId") as string | null) || null;
  const assigneeMemberId =
    assigneeMemberIdRaw && assigneeMemberIdRaw !== UNASSIGNED_MEMBER_VALUE ? assigneeMemberIdRaw : null;

  if (!title) {
    throw new Error("Название задачи обязательно");
  }
  if (!TASK_PRIORITY_VALUES.has(priorityRaw)) {
    throw new Error("Некорректный приоритет");
  }

  return {
    title,
    description,
    priority: priorityRaw as TaskPriority,
    deadline: deadlineRaw ? new Date(deadlineRaw) : null,
    assigneeMemberId,
  };
}

// Участник проекта, которому назначается задача — заодно тянем email/имя,
// они нужны для уведомления и письма (см. notifyTaskAssigned/
// sendTaskAssignedEmail), чтобы не делать отдельный запрос после.
async function loadAssigneeOrThrow(assigneeMemberId: string, projectId: string) {
  const member = await prisma.projectMember.findUnique({
    where: { id: assigneeMemberId },
    select: { projectId: true, user: { select: { id: true, email: true, fullName: true } } },
  });
  if (!member || member.projectId !== projectId) {
    throw new Error("Исполнитель должен быть участником этого проекта");
  }
  return member.user;
}

// Создавать/редактировать/удалять задачи и назначать/менять
// исполнителя-срок-приоритет может только руководитель ЭТОГО департамента
// (или администратор) — сотрудник задачи не редактирует вообще, только
// двигает статус своей задачи (см. advanceTaskStatusAction).
export async function createTaskAction(sectionId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  const section = await loadSectionForPermissionCheck(sectionId);
  if (!canManageProjectTasks(session.user, section)) {
    throw new Error("Недостаточно прав для создания задач в этом разделе");
  }

  const fields = parseTaskFields(formData);

  const assignee = fields.assigneeMemberId
    ? await loadAssigneeOrThrow(fields.assigneeMemberId, section.projectId)
    : null;

  await prisma.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: {
        sectionId,
        title: fields.title,
        description: fields.description,
        priority: fields.priority,
        deadline: fields.deadline,
        assigneeMemberId: fields.assigneeMemberId,
        assignedByUserId: session.user.id,
      },
    });

    await logActivity(tx, {
      projectId: section.projectId,
      actorId: session.user.id,
      message: `${session.user.name} создал(а) задачу «${task.title}»`,
    });

    if (assignee) {
      await notifyTaskAssigned(tx, {
        userId: assignee.id,
        actorId: session.user.id,
        taskId: task.id,
        taskTitle: task.title,
        projectName: section.project.name,
      });
    }
  });

  if (assignee) {
    sendTaskAssignedEmail({
      to: assignee.email,
      employeeName: assignee.fullName,
      taskTitle: fields.title,
      projectName: section.project.name,
      deadline: fields.deadline,
    }).catch((error) => {
      console.error("Не удалось отправить уведомление о назначении задачи", error);
    });
  }

  revalidatePath(`/projects/${section.projectId}`);
}

async function loadTaskForPermissionCheck(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      status: true,
      title: true,
      deadline: true,
      assigneeMemberId: true,
      section: {
        select: {
          id: true,
          projectId: true,
          project: { select: { name: true } },
          department: { select: { id: true, managerId: true } },
        },
      },
      assigneeMember: {
        select: { userId: true, user: { select: { id: true, email: true, fullName: true } } },
      },
    },
  });
  if (!task) {
    throw new Error("Задача не найдена");
  }
  return task;
}

// Редактирование полей задачи (название/описание/приоритет/срок/
// исполнитель) — форма всегда присылает ВСЕ поля (см. task-dialog.tsx,
// значения по умолчанию заполнены из текущей задачи). Смена статуса —
// отдельное, более лёгкое действие (updateTaskStatusAction), т.к. пункт
// статуса в интерфейсе (Select в карточке задачи) отправляет только новый
// статус, без остальных полей формы.
export async function updateTaskAction(taskId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  const task = await loadTaskForPermissionCheck(taskId);
  if (!canManageProjectTasks(session.user, task.section)) {
    throw new Error("Недостаточно прав для редактирования этой задачи");
  }

  const fields = parseTaskFields(formData);

  const assigneeUser = fields.assigneeMemberId
    ? await loadAssigneeOrThrow(fields.assigneeMemberId, task.section.projectId)
    : null;
  const isReassignment =
    fields.assigneeMemberId !== null && fields.assigneeMemberId !== task.assigneeMemberId;
  const newAssignee = isReassignment ? assigneeUser : null;

  // Срок считается "изменённым" только когда исполнитель НЕ меняется в этом
  // же вызове — при реассайне новый исполнитель уже получает
  // notifyTaskAssigned/письмо о назначении, второе уведомление было бы шумом.
  const deadlineChanged =
    !isReassignment &&
    task.assigneeMember !== null &&
    (task.deadline?.getTime() ?? null) !== (fields.deadline?.getTime() ?? null);

  await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: taskId },
      data: {
        title: fields.title,
        description: fields.description,
        priority: fields.priority,
        deadline: fields.deadline,
        assigneeMemberId: fields.assigneeMemberId,
      },
    });

    if (isReassignment && newAssignee) {
      await notifyTaskAssigned(tx, {
        userId: newAssignee.id,
        actorId: session.user.id,
        taskId: task.id,
        taskTitle: fields.title,
        projectName: task.section.project.name,
      });
    }

    if (deadlineChanged && task.assigneeMember) {
      await notifyDeadlineChanged(tx, {
        userId: task.assigneeMember.userId,
        actorId: session.user.id,
        taskId: task.id,
        taskTitle: fields.title,
        projectName: task.section.project.name,
      });
    }
  });

  if (isReassignment && newAssignee) {
    sendTaskAssignedEmail({
      to: newAssignee.email,
      employeeName: newAssignee.fullName,
      taskTitle: fields.title,
      projectName: task.section.project.name,
      deadline: fields.deadline,
    }).catch((error) => {
      console.error("Не удалось отправить уведомление о назначении задачи", error);
    });
  }

  if (deadlineChanged && task.assigneeMember) {
    sendDeadlineChangedEmail({
      to: task.assigneeMember.user.email,
      employeeName: task.assigneeMember.user.fullName,
      taskTitle: fields.title,
      projectName: task.section.project.name,
      deadline: fields.deadline,
    }).catch((error) => {
      console.error("Не удалось отправить письмо об изменении срока", error);
    });
  }

  revalidatePath(`/projects/${task.section.projectId}`);
}

// Смена статуса менеджером/администратором в ЛЮБУЮ сторону, включая назад
// ("вернуть на доработку") — в отличие от advanceTaskStatusAction, здесь
// нет ограничения "только на один шаг вперёд" (см. бриф: "Return For
// Revision", "Approve Task").
export async function updateTaskStatusAction(taskId: string, nextStatus: TaskStatus) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }
  if (!TASK_STATUS_VALUES.has(nextStatus)) {
    throw new Error("Некорректный статус");
  }

  const task = await loadTaskForPermissionCheck(taskId);
  // Полная свобода смены статуса (любое направление, не только вперёд) —
  // либо руководитель/администратор департамента, либо сам исполнитель
  // своей же задачи (по просьбе пользователя: сотрудник должен уметь сам
  // вернуть свою задачу с "Выполнено" на "На проверке"/"В работе", а не
  // только двигать её вперёд).
  const isAssignee = task.assigneeMember?.userId === session.user.id;
  if (!canManageProjectTasks(session.user, task.section) && !isAssignee) {
    throw new Error("Недостаточно прав для изменения статуса этой задачи");
  }

  if (nextStatus === task.status) {
    return;
  }

  const isRevision = FORWARD_TRANSITIONS[nextStatus] === task.status;
  const isApproval = task.status === TaskStatus.НА_ПРОВЕРКЕ && nextStatus === TaskStatus.ВЫПОЛНЕНО;
  // Достигли "На проверке" (с любой стороны, не только форвардом) —
  // руководителя департамента (или всех админов, если не задан) нужно
  // уведомить, что задача ждёт его — перенесено сюда из бывшего
  // advanceTaskStatusAction, который эта функция теперь полностью заменяет.
  const isReachingReview = nextStatus === TaskStatus.НА_ПРОВЕРКЕ;
  // Не уведомляем исполнителя о его же собственном действии над своей
  // задачей — уведомления здесь имеют смысл только когда статус поменял
  // КТО-ТО ДРУГОЙ (обычно руководитель).
  const notifyAssignee = task.assigneeMember && task.assigneeMember.userId !== session.user.id;
  const reviewRecipients = isReachingReview ? await resolveReviewRecipients(task.section.department) : [];
  // "Взял в работу" — по прямой просьбе Камилы руководителю нужно знать,
  // когда сотрудник САМ начинает задачу (Новая → В работе). Если статус
  // на это же значение ставит руководитель/админ (не сам исполнитель) —
  // это не "сотрудник начал работу", а обычное административное действие,
  // уведомление не нужно (та же логика, что и notifyAssignee выше).
  const isStartingWork =
    task.status === TaskStatus.НОВАЯ && nextStatus === TaskStatus.В_РАБОТЕ && isAssignee;
  const startRecipients = isStartingWork ? await resolveReviewRecipients(task.section.department) : [];

  await prisma.$transaction(async (tx) => {
    await tx.task.update({ where: { id: taskId }, data: { status: nextStatus } });

    const message = isRevision
      ? `${session.user.name} вернул(а) задачу «${task.title}» на доработку`
      : isReachingReview
        ? `${session.user.name} отправил(а) задачу «${task.title}» на проверку`
        : nextStatus === TaskStatus.ВЫПОЛНЕНО
          ? `${session.user.name} выполнил(а) задачу «${task.title}»`
          : `${session.user.name} изменил(а) статус задачи «${task.title}» на «${TASK_STATUS_LABELS[nextStatus]}»`;
    await logActivity(tx, { projectId: task.section.projectId, actorId: session.user.id, message });

    if (isRevision && notifyAssignee && task.assigneeMember) {
      await notifyTaskReturned(tx, {
        userId: task.assigneeMember.userId,
        actorId: session.user.id,
        taskId: task.id,
        taskTitle: task.title,
        projectName: task.section.project.name,
      });
    }

    if (isApproval && notifyAssignee && task.assigneeMember) {
      await notifyTaskApproved(tx, {
        userId: task.assigneeMember.userId,
        actorId: session.user.id,
        taskId: task.id,
        taskTitle: task.title,
        projectName: task.section.project.name,
      });
    }

    for (const recipient of reviewRecipients) {
      await notifyTaskReadyForReview(tx, {
        userId: recipient.id,
        actorId: session.user.id,
        taskId: task.id,
        taskTitle: task.title,
        employeeName: session.user.name ?? "Сотрудник",
        projectName: task.section.project.name,
      });
    }

    for (const recipient of startRecipients) {
      await notifyTaskStarted(tx, {
        userId: recipient.id,
        actorId: session.user.id,
        taskId: task.id,
        taskTitle: task.title,
        employeeName: session.user.name ?? "Сотрудник",
        projectName: task.section.project.name,
      });
    }
  });

  if (isRevision && notifyAssignee && task.assigneeMember) {
    sendTaskReturnedEmail({
      to: task.assigneeMember.user.email,
      employeeName: task.assigneeMember.user.fullName,
      taskTitle: task.title,
      projectName: task.section.project.name,
    }).catch((error) => {
      console.error("Не удалось отправить письмо о возврате задачи", error);
    });
  }

  if (isApproval && notifyAssignee && task.assigneeMember) {
    sendTaskApprovedEmail({
      to: task.assigneeMember.user.email,
      employeeName: task.assigneeMember.user.fullName,
      taskTitle: task.title,
      projectName: task.section.project.name,
    }).catch((error) => {
      console.error("Не удалось отправить письмо об одобрении задачи", error);
    });
  }

  for (const recipient of reviewRecipients) {
    sendTaskReadyForReviewEmail({
      to: recipient.email,
      managerName: recipient.fullName,
      taskTitle: task.title,
      employeeName: session.user.name ?? "Сотрудник",
      projectName: task.section.project.name,
    }).catch((error) => {
      console.error("Не удалось отправить уведомление о готовности задачи к проверке", error);
    });
  }

  for (const recipient of startRecipients) {
    sendTaskStartedEmail({
      to: recipient.email,
      managerName: recipient.fullName,
      taskTitle: task.title,
      employeeName: session.user.name ?? "Сотрудник",
      projectName: task.section.project.name,
    }).catch((error) => {
      console.error("Не удалось отправить письмо о начале работы над задачей", error);
    });
  }

  revalidatePath(`/projects/${task.section.projectId}`);
}

// Ручное каскадное удаление (в схеме нет onDelete: Cascade, см.
// prisma/schema.prisma) — у задачи есть Comment и Notification как
// зависимые записи (Document пока не привязан к Task, вложения вне зоны
// охвата этого этапа).
export async function deleteTaskAction(taskId: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  const task = await loadTaskForPermissionCheck(taskId);
  if (!canManageProjectTasks(session.user, task.section)) {
    throw new Error("Недостаточно прав для удаления этой задачи");
  }

  const attachments = await prisma.document.findMany({
    where: { taskId },
    select: { fileUrl: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.notification.deleteMany({ where: { taskId } });
    await tx.document.deleteMany({ where: { taskId } });
    await tx.comment.deleteMany({ where: { taskId } });
    await tx.taskChecklistItem.deleteMany({ where: { taskId } });
    await tx.task.delete({ where: { id: taskId } });

    await logActivity(tx, {
      projectId: task.section.projectId,
      actorId: session.user.id,
      message: `${session.user.name} удалил(а) задачу «${task.title}»`,
    });
  });

  // Файлы в Blob — best-effort, как и остальные удаления вложений.
  for (const attachment of attachments) {
    del(attachment.fileUrl).catch((error) => {
      console.error("Не удалось удалить файл из Blob", error);
    });
  }

  revalidatePath(`/projects/${task.section.projectId}`);
}

// Кому уходит уведомление "задача на проверке" — руководителю ЭТОГО
// департамента, а если он не назначен (или у раздела вообще нет
// департамента, см. D4 "Без отдела"), то всем администраторам компании,
// чтобы событие не потерялось (см. план, Phase 5: "или admin, если не
// задан").
async function resolveReviewRecipients(department: { managerId: string | null } | null) {
  if (department?.managerId) {
    const manager = await prisma.user.findUnique({
      where: { id: department.managerId },
      select: { id: true, email: true, fullName: true },
    });
    return manager ? [manager] : [];
  }

  return prisma.user.findMany({
    where: { systemRole: SystemRole.РУКОВОДИТЕЛЬ },
    select: { id: true, email: true, fullName: true },
  });
}

// Галочка чек-листа внутри задачи — доступна исполнителю (сам отмечает свой
// прогресс) или руководителю/администратору этого департамента, та же
// аудитория, что и у остальных действий над статусом задачи. Никакого
// отдельного лога/уведомления — это лёгкий чек-лист, не событие.
export async function toggleTaskChecklistItemAction(itemId: string, isDone: boolean) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  const item = await prisma.taskChecklistItem.findUnique({
    where: { id: itemId },
    select: {
      taskId: true,
      task: {
        select: {
          section: {
            select: {
              projectId: true,
              department: { select: { id: true, managerId: true } },
            },
          },
          assigneeMember: { select: { userId: true } },
        },
      },
    },
  });
  if (!item) {
    throw new Error("Пункт чек-листа не найден");
  }

  const isAssignee = item.task.assigneeMember?.userId === session.user.id;
  const isManager = canManageProjectTasks(session.user, item.task.section);
  if (!isAssignee && !isManager) {
    throw new Error("Недостаточно прав для изменения этого пункта чек-листа");
  }

  await prisma.taskChecklistItem.update({ where: { id: itemId }, data: { isDone } });

  revalidatePath(`/projects/${item.task.section.projectId}`);
}
