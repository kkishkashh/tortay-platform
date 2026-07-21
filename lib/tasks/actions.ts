"use server";

import { revalidatePath } from "next/cache";
import { SystemRole, TaskPriority, TaskStatus } from "@prisma/client";

import { auth } from "@/auth";
import { logActivity } from "@/lib/activity/log";
import { sendTaskAssignedEmail, sendTaskReadyForReviewEmail } from "@/lib/email/send";
import { notifyTaskAssigned, notifyTaskReadyForReview } from "@/lib/notifications/notify";
import { prisma } from "@/lib/prisma";
import { TASK_STATUS_LABELS } from "@/lib/projects/status-labels";
import { canAdvanceTaskStatus, canManageProjectTasks, FORWARD_TRANSITIONS } from "@/lib/tasks/permissions";
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
      assigneeMemberId: true,
      section: {
        select: {
          id: true,
          projectId: true,
          project: { select: { name: true } },
          department: { select: { id: true, managerId: true } },
        },
      },
      assigneeMember: { select: { userId: true } },
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
  if (!canManageProjectTasks(session.user, task.section)) {
    throw new Error("Недостаточно прав для изменения статуса этой задачи");
  }

  if (nextStatus === task.status) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.task.update({ where: { id: taskId }, data: { status: nextStatus } });

    const isRevision = FORWARD_TRANSITIONS[nextStatus] === task.status;
    const message = isRevision
      ? `${session.user.name} вернул(а) задачу «${task.title}» на доработку`
      : `${session.user.name} изменил(а) статус задачи «${task.title}» на «${TASK_STATUS_LABELS[nextStatus]}»`;
    await logActivity(tx, { projectId: task.section.projectId, actorId: session.user.id, message });
  });

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

  await prisma.$transaction(async (tx) => {
    await tx.notification.deleteMany({ where: { taskId } });
    await tx.comment.deleteMany({ where: { taskId } });
    await tx.task.delete({ where: { id: taskId } });

    await logActivity(tx, {
      projectId: task.section.projectId,
      actorId: session.user.id,
      message: `${session.user.name} удалил(а) задачу «${task.title}»`,
    });
  });

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

// Единственное действие, доступное исполнителю задачи: перевести СВОЮ
// задачу на один шаг вперёд по фиксированному циклу. Тот же экшен могут
// вызвать и менеджер/администратор — тоже только вперёд (для движения
// назад у них есть updateTaskStatusAction). Проверка на сервере
// обязательна: это не просто скрытая в интерфейсе кнопка (см.
// lib/tasks/permissions.ts).
export async function advanceTaskStatusAction(taskId: string, nextStatus: TaskStatus) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  const task = await loadTaskForPermissionCheck(taskId);

  const allowedNext = FORWARD_TRANSITIONS[task.status];
  if (!allowedNext || allowedNext !== nextStatus) {
    throw new Error("Недопустимый переход статуса");
  }

  const isManager = canManageProjectTasks(session.user, task.section);
  const isAssignee = canAdvanceTaskStatus(session.user, task, nextStatus);
  if (!isManager && !isAssignee) {
    throw new Error("Недостаточно прав для изменения статуса этой задачи");
  }

  const reviewRecipients =
    nextStatus === TaskStatus.НА_ПРОВЕРКЕ ? await resolveReviewRecipients(task.section.department) : [];

  await prisma.$transaction(async (tx) => {
    await tx.task.update({ where: { id: taskId }, data: { status: nextStatus } });

    const message =
      nextStatus === TaskStatus.НА_ПРОВЕРКЕ
        ? `${session.user.name} отправил(а) задачу «${task.title}» на проверку`
        : nextStatus === TaskStatus.ВЫПОЛНЕНО
          ? `${session.user.name} выполнил(а) задачу «${task.title}»`
          : `${session.user.name} перевёл(а) задачу «${task.title}» в статус «В работе»`;
    await logActivity(tx, { projectId: task.section.projectId, actorId: session.user.id, message });

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
  });

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

  revalidatePath(`/projects/${task.section.projectId}`);
}
