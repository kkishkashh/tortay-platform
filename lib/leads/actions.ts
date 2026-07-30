"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { isPrivilegedOverride, recordAuditLog } from "@/lib/audit/log";
import { canManageDepartment } from "@/lib/departments/permissions";
import { notifyLeadDemoted, notifyLeadPromoted, notifyTaskAssigned } from "@/lib/notifications/notify";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity/log";
import { canManageProjectTasks } from "@/lib/tasks/permissions";

// Назначает/снимает Лида сотрудника (Task 5.x, PRD #3 Phase 3) — задаёт
// employee.reportsToId. Только руководитель ЭТОГО департамента (или
// администратор), и только если Department.allowsLeadRole включён (см.
// app/(dashboard)/departments/[id]/settings-tab.tsx). "Быть Лидом" — не
// отдельное поле на самой записи Лида, а чисто производный статус: как
// только у кого-то reportsToId указывает сюда, человек и становится
// Лидом (см. lib/leads/queries.ts::isLead).
export async function setEmployeeLeadAction(employeeId: string, leadUserId: string | null) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  const employee = await prisma.user.findUnique({
    where: { id: employeeId },
    select: { id: true, fullName: true, homeDepartmentId: true, reportsToId: true },
  });
  if (!employee?.homeDepartmentId) {
    throw new Error("У сотрудника нет департамента");
  }

  const department = await prisma.department.findUnique({
    where: { id: employee.homeDepartmentId },
    select: { id: true, name: true, managerId: true, allowsLeadRole: true },
  });
  if (!department || !canManageDepartment(session.user, department)) {
    throw new Error("Недостаточно прав");
  }
  if (!department.allowsLeadRole) {
    throw new Error("В этом департаменте роль Лида не включена");
  }
  if (leadUserId === employeeId) {
    throw new Error("Сотрудник не может подчиняться самому себе");
  }

  if (leadUserId) {
    const lead = await prisma.user.findUnique({
      where: { id: leadUserId },
      select: { homeDepartmentId: true, reportsToId: true },
    });
    if (!lead || lead.homeDepartmentId !== department.id) {
      throw new Error("Лид должен состоять в том же департаменте");
    }
    // Ограничение в 2 уровня (Руководитель → Лид → Сотрудник) — Лид сам
    // не может кому-то подчиняться, иначе иерархия усложняется без
    // реальной необходимости (см. план).
    if (lead.reportsToId) {
      throw new Error("Этот сотрудник сам кому-то подчиняется — не может одновременно быть Лидом");
    }
    // Обратная сторона того же ограничения: сотрудника, у которого уже
    // ЕСТЬ свои подчинённые (сам Лид), нельзя назначить чьим-то
    // подчинённым — сначала нужно снять с него всех его подчинённых.
    const employeeHasReports = await prisma.user.count({ where: { reportsToId: employeeId } });
    if (employeeHasReports > 0) {
      throw new Error("Этот сотрудник сам руководит другими — сначала переназначьте его подчинённых");
    }
  }

  const previousLeadId = employee.reportsToId;
  if (previousLeadId === leadUserId) return;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: employeeId }, data: { reportsToId: leadUserId } });

    await recordAuditLog(tx, {
      actorId: session.user.id,
      action: leadUserId ? "lead_assign" : "lead_unassign",
      targetType: "User",
      targetId: employeeId,
      isOverride: isPrivilegedOverride(session.user) && department.managerId !== session.user.id,
    });

    if (leadUserId) {
      const existingReports = await tx.user.count({
        where: { reportsToId: leadUserId, id: { not: employeeId } },
      });
      if (existingReports === 0) {
        await notifyLeadPromoted(tx, {
          userId: leadUserId,
          actorId: session.user.id,
          departmentName: department.name,
        });
      }
    }

    if (previousLeadId) {
      const remainingReports = await tx.user.count({ where: { reportsToId: previousLeadId } });
      if (remainingReports === 0) {
        await notifyLeadDemoted(tx, { userId: previousLeadId, actorId: session.user.id });
      }
    }
  });

  revalidatePath(`/departments/${department.id}`);
  revalidatePath(`/employees/${employeeId}`);
  if (leadUserId) revalidatePath(`/employees/${leadUserId}`);
  if (previousLeadId) revalidatePath(`/employees/${previousLeadId}`);
}

// Назначение исполнителя задачи Лидом (Task 5.2/5.4) — узкое отдельное
// действие, а не расширение canManageProjectTasks: Лид получает право
// назначать задачи ТОЛЬКО своим прямым подчинённым, ничего больше
// (не редактирует название/приоритет/срок — это остаётся у руководителя
// департамента/администратора). Если у вызывающего и так есть полное
// право на задачи раздела (canManageProjectTasks), эта функция не нужна —
// используется updateTaskAction.
export async function leadAssignTaskAction(taskId: string, assigneeMemberId: string | null) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      title: true,
      assigneeMemberId: true,
      section: {
        select: {
          projectId: true,
          project: { select: { name: true } },
          department: { select: { id: true, managerId: true } },
        },
      },
    },
  });
  if (!task) {
    throw new Error("Задача не найдена");
  }

  // Если у вызывающего и так есть полный доступ к задачам раздела — эта
  // узкая проверка ему не нужна, но и не мешает: пусть тоже проходит.
  if (!canManageProjectTasks(session.user, task.section)) {
    const reportIds = new Set(
      (await prisma.user.findMany({ where: { reportsToId: session.user.id }, select: { id: true } })).map(
        (u) => u.id,
      ),
    );
    if (reportIds.size === 0) {
      throw new Error("Недостаточно прав для назначения исполнителя");
    }

    if (assigneeMemberId) {
      const member = await prisma.projectMember.findUnique({
        where: { id: assigneeMemberId },
        select: { projectId: true, userId: true },
      });
      if (!member || member.projectId !== task.section.projectId || !reportIds.has(member.userId)) {
        throw new Error("Можно назначать только своим подчинённым");
      }
    } else {
      // Снимать назначение Лид может только со СВОЕГО подчинённого — не с
      // произвольного исполнителя, которого назначил кто-то другой.
      const currentAssignee = task.assigneeMemberId
        ? await prisma.projectMember.findUnique({
            where: { id: task.assigneeMemberId },
            select: { userId: true },
          })
        : null;
      if (!currentAssignee || !reportIds.has(currentAssignee.userId)) {
        throw new Error("Можно снимать назначение только со своих подчинённых");
      }
    }
  }

  const assignee = assigneeMemberId
    ? await prisma.projectMember.findUnique({
        where: { id: assigneeMemberId },
        select: { user: { select: { id: true, email: true, fullName: true } } },
      })
    : null;

  await prisma.$transaction(async (tx) => {
    await tx.task.update({ where: { id: taskId }, data: { assigneeMemberId } });

    await logActivity(tx, {
      projectId: task.section.projectId,
      actorId: session.user.id,
      message: assignee
        ? `${session.user.name} назначил(а) ${assignee.user.fullName} исполнителем задачи «${task.title}»`
        : `${session.user.name} снял(а) исполнителя с задачи «${task.title}»`,
    });

    if (assignee) {
      await notifyTaskAssigned(tx, {
        userId: assignee.user.id,
        actorId: session.user.id,
        taskId: task.id,
        taskTitle: task.title,
        projectName: task.section.project.name,
      });
    }
  });

  revalidatePath(`/projects/${task.section.projectId}`);
}
