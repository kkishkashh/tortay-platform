"use server";

import { revalidatePath } from "next/cache";
import { ProjectRole, SystemRole, TaskPriority, TaskStatus } from "@prisma/client";
import { del } from "@vercel/blob";

import { auth } from "@/auth";
import { logActivity } from "@/lib/activity/log";
import { isPrivilegedOverride, recordAuditLog } from "@/lib/audit/log";
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
import { ensureProjectMember } from "@/lib/projects/membership";
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
      department: { select: { id: true, managers: { select: { id: true } } } },
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
  const assigneeUserIdRaw = (formData.get("assigneeUserId") as string | null) || null;
  const assigneeUserId =
    assigneeUserIdRaw && assigneeUserIdRaw !== UNASSIGNED_MEMBER_VALUE ? assigneeUserIdRaw : null;

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
    assigneeUserId,
  };
}

// Исполнитель задачи выбирается из ВСЕХ сотрудников платформы (не только
// уже добавленных в этот проект, 2026-08-06 по прямой просьбе — раньше
// список ограничивался ProjectMember этого проекта, из-за чего часть
// сотрудников "пропадала" из пикера) — заодно тянем email/имя, они нужны
// для уведомления и письма (см. notifyTaskAssigned/sendTaskAssignedEmail),
// чтобы не делать отдельный запрос после. Членство в проекте (ProjectMember,
// см. Task.assigneeMemberId) обеспечивается отдельно через
// ensureProjectMember прямо в транзакции создания/сохранения задачи.
async function loadAssigneeUserOrThrow(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, fullName: true },
  });
  if (!user) {
    throw new Error("Сотрудник не найден");
  }
  return user;
}

// Создавать/редактировать/удалять задачи и назначать/менять
// исполнителя-срок-приоритет может только руководитель ЭТОГО департамента
// (или администратор) — сотрудник задачи не редактирует вообще, только
// двигает статус своей задачи (см. advanceTaskStatusAction).
//
// Создание задач в существующем разделе (см. TaskDialog) устроено так же,
// как шаг "Задачи" мастера создания проекта (см. new-project-dialog.tsx/
// createProjectAction) — по прямой просьбе, "один в один": чекбоксами
// отмечаются сразу несколько пунктов стека департамента (плюс свои
// произвольные задачи), и все они создаются одним действием с общими
// сроком/приоритетом/исполнителем. Раньше здесь была отдельная
// createTaskAction на одну задачу за раз — заменена этой функцией.
export async function createTasksFromStackAction(sectionId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  const section = await loadSectionForPermissionCheck(sectionId);
  if (!canManageProjectTasks(session.user, section)) {
    throw new Error("Недостаточно прав для создания задач в этом разделе");
  }

  const priorityRaw = (formData.get("priority") as string | null) ?? TaskPriority.СРЕДНИЙ;
  if (!TASK_PRIORITY_VALUES.has(priorityRaw)) {
    throw new Error("Некорректный приоритет");
  }
  const priority = priorityRaw as TaskPriority;
  const deadlineRaw = formData.get("deadline") as string | null;
  const deadline = deadlineRaw ? new Date(deadlineRaw) : null;
  const assigneeUserIdRaw = (formData.get("assigneeUserId") as string | null) || null;
  const assigneeUserId =
    assigneeUserIdRaw && assigneeUserIdRaw !== UNASSIGNED_MEMBER_VALUE ? assigneeUserIdRaw : null;

  const assignee = assigneeUserId ? await loadAssigneeUserOrThrow(assigneeUserId) : null;

  const templateItemIds = Array.from(new Set(formData.getAll("templateItemId") as string[]));
  const checkedSubItemIds = new Set(formData.getAll("subItemId") as string[]);
  const customTaskTitles = (formData.getAll("customTaskTitle") as string[])
    .map((title) => title.trim())
    .filter((title) => title.length > 0);

  if (templateItemIds.length === 0 && customTaskTitles.length === 0) {
    throw new Error("Выберите хотя бы одну задачу");
  }

  type PlannedTask = {
    title: string;
    description: string | null;
    weight: number;
    checklistTitles: string[];
  };
  let plannedTasks: PlannedTask[] = customTaskTitles.map((title) => ({
    title,
    description: null,
    weight: 1,
    checklistTitles: [],
  }));

  if (templateItemIds.length > 0) {
    if (!section.department) {
      throw new Error("У раздела без департамента нет стека задач");
    }
    const templateItems = await prisma.departmentTaskTemplateItem.findMany({
      where: { id: { in: templateItemIds } },
      select: {
        id: true,
        departmentId: true,
        title: true,
        description: true,
        weight: true,
        subItems: { select: { id: true, title: true }, orderBy: { orderIndex: "asc" } },
      },
    });
    // Каждый пункт должен реально принадлежать департаменту ЭТОГО раздела —
    // защита от подмены id в обход формы (напр. пункт из чужого стека).
    if (
      templateItems.length !== templateItemIds.length ||
      templateItems.some((item) => item.departmentId !== section.department!.id)
    ) {
      throw new Error("Пункт стека не найден для этого раздела");
    }
    plannedTasks = [
      ...templateItems.map((item) => ({
        title: item.title,
        description: item.description,
        weight: item.weight,
        checklistTitles: item.subItems
          .filter((sub) => checkedSubItemIds.has(sub.id))
          .map((sub) => sub.title),
      })),
      ...plannedTasks,
    ];
  }

  const createdTasks = await prisma.$transaction(async (tx) => {
    let assigneeMemberId: string | null = null;
    if (assigneeUserId) {
      const { member } = await ensureProjectMember(tx, {
        projectId: section.projectId,
        userId: assigneeUserId,
        role: ProjectRole.ИНЖЕНЕР,
        actorId: session.user.id,
        projectName: section.project.name,
      });
      assigneeMemberId = member.id;
    }

    const results: { id: string; title: string }[] = [];
    for (const plan of plannedTasks) {
      const task = await tx.task.create({
        data: {
          sectionId,
          title: plan.title,
          description: plan.description,
          priority,
          deadline,
          assigneeMemberId,
          assignedByUserId: session.user.id,
          weight: plan.weight,
        },
      });

      if (plan.checklistTitles.length > 0) {
        await tx.taskChecklistItem.createMany({
          data: plan.checklistTitles.map((title, index) => ({
            taskId: task.id,
            title,
            orderIndex: index,
          })),
        });
      }

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

      results.push({ id: task.id, title: task.title });
    }
    return results;
  });

  if (assignee) {
    for (const task of createdTasks) {
      sendTaskAssignedEmail({
        to: assignee.email,
        employeeName: assignee.fullName,
        taskTitle: task.title,
        projectName: section.project.name,
        deadline,
      }).catch((error) => {
        console.error("Не удалось отправить уведомление о назначении задачи", error);
      });
    }
  }

  revalidatePath(`/projects/${section.projectId}`);
}

// По прямой просьбе Камилы (2026-07-30): со страницы профиля сотрудника —
// выбрать существующий проект/раздел и сразу создать в нём задачу ИМЕННО
// для этого сотрудника, без похода на страницу проекта. Право на
// создание — то же самое, что и у createTasksFromStackAction (canManageProjectTasks
// этого раздела), поэтому руководитель департамента может так делать
// только в разделах СВОЕГО департамента (см.
// lib/projects/queries.ts::getManageableProjectsForTaskCreation — список
// в форме уже отфильтрован так же, сервер это дублирует). Сотрудник
// становится участником проекта автоматически, даже если раньше им не был.
export async function createTaskForEmployeeAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  const employeeUserId = formData.get("employeeUserId") as string | null;
  const sectionId = formData.get("sectionId") as string | null;
  if (!employeeUserId || !sectionId) {
    throw new Error("Выберите проект и раздел");
  }

  const section = await loadSectionForPermissionCheck(sectionId);
  if (!canManageProjectTasks(session.user, section)) {
    throw new Error("Недостаточно прав для создания задач в этом разделе");
  }

  const employee = await prisma.user.findUnique({
    where: { id: employeeUserId },
    select: { email: true, fullName: true },
  });
  if (!employee) {
    throw new Error("Сотрудник не найден");
  }

  const fields = parseTaskFields(formData);

  await prisma.$transaction(async (tx) => {
    const { member } = await ensureProjectMember(tx, {
      projectId: section.projectId,
      userId: employeeUserId,
      role: ProjectRole.ИНЖЕНЕР,
      actorId: session.user.id,
      projectName: section.project.name,
    });

    const task = await tx.task.create({
      data: {
        sectionId,
        title: fields.title,
        description: fields.description,
        priority: fields.priority,
        deadline: fields.deadline,
        assigneeMemberId: member.id,
        assignedByUserId: session.user.id,
      },
    });

    await logActivity(tx, {
      projectId: section.projectId,
      actorId: session.user.id,
      message: `${session.user.name} создал(а) задачу «${task.title}» для ${employee.fullName}`,
    });

    await notifyTaskAssigned(tx, {
      userId: employeeUserId,
      actorId: session.user.id,
      taskId: task.id,
      taskTitle: task.title,
      projectName: section.project.name,
    });
  });

  sendTaskAssignedEmail({
    to: employee.email,
    employeeName: employee.fullName,
    taskTitle: fields.title,
    projectName: section.project.name,
    deadline: fields.deadline,
  }).catch((error) => {
    console.error("Не удалось отправить уведомление о назначении задачи", error);
  });

  revalidatePath(`/projects/${section.projectId}`);
  revalidatePath(`/employees/${employeeUserId}`);
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
      assignedByUserId: true,
      section: {
        select: {
          id: true,
          projectId: true,
          project: { select: { name: true } },
          department: { select: { id: true, managers: { select: { id: true } } } },
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

  const assigneeUser = fields.assigneeUserId
    ? await loadAssigneeUserOrThrow(fields.assigneeUserId)
    : null;
  const isReassignment =
    fields.assigneeUserId !== null && fields.assigneeUserId !== task.assigneeMember?.userId;
  const newAssignee = isReassignment ? assigneeUser : null;
  const isUnassignment = fields.assigneeUserId === null && task.assigneeMemberId !== null;
  // Task 1.1 (аудит-лог): вмешательство в чужую задачу — исполнителя меняет
  // администратор/бухгалтер (см. isPrivilegedOverride), а задачу изначально
  // назначил КТО-ТО ДРУГОЙ (обычно руководитель департамента).
  const isOverride =
    isPrivilegedOverride(session.user) &&
    !!task.assignedByUserId &&
    task.assignedByUserId !== session.user.id;

  // Срок считается "изменённым" только когда исполнитель НЕ меняется в этом
  // же вызове — при реассайне новый исполнитель уже получает
  // notifyTaskAssigned/письмо о назначении, второе уведомление было бы шумом.
  const deadlineChanged =
    !isReassignment &&
    task.assigneeMember !== null &&
    (task.deadline?.getTime() ?? null) !== (fields.deadline?.getTime() ?? null);

  await prisma.$transaction(async (tx) => {
    let assigneeMemberId: string | null = null;
    if (fields.assigneeUserId) {
      const { member } = await ensureProjectMember(tx, {
        projectId: task.section.projectId,
        userId: fields.assigneeUserId,
        role: ProjectRole.ИНЖЕНЕР,
        actorId: session.user.id,
        projectName: task.section.project.name,
      });
      assigneeMemberId = member.id;
    }

    await tx.task.update({
      where: { id: taskId },
      data: {
        title: fields.title,
        description: fields.description,
        priority: fields.priority,
        deadline: fields.deadline,
        assigneeMemberId,
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

    if (isReassignment || isUnassignment) {
      await recordAuditLog(tx, {
        actorId: session.user.id,
        action: isReassignment ? "task_reassign" : "task_unassign",
        targetType: "Task",
        targetId: task.id,
        isOverride,
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

// Кому уходит уведомление "задача на проверке" — ВСЕМ руководителям ЭТОГО
// департамента (с 2026-07-31 их может быть несколько), а если ни одного не
// назначено (или у раздела вообще нет департамента, см. D4 "Без отдела"),
// то всем администраторам компании, чтобы событие не потерялось (см. план,
// Phase 5: "или admin, если не задан").
async function resolveReviewRecipients(department: { managers: { id: string }[] } | null) {
  if (department && department.managers.length > 0) {
    return prisma.user.findMany({
      where: { id: { in: department.managers.map((m) => m.id) } },
      select: { id: true, email: true, fullName: true },
    });
  }

  return prisma.user.findMany({
    where: {
      systemRole: {
        in: [SystemRole.АДМИН, SystemRole.ГЛАВНЫЙ_ТЕХНИЧЕСКИЙ_ДИРЕКТОР, SystemRole.РУКОВОДИТЕЛЬ],
      },
    },
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
              department: { select: { id: true, managers: { select: { id: true } } } },
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
