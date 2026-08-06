"use server";

import { revalidatePath } from "next/cache";

import { ProjectRole } from "@prisma/client";

import { auth } from "@/auth";
import { isPrivilegedOverride, recordAuditLog } from "@/lib/audit/log";
import { canManageDepartment } from "@/lib/departments/permissions";
import { notifyLeadDemoted, notifyLeadPromoted, notifyTaskAssigned } from "@/lib/notifications/notify";
import { prisma } from "@/lib/prisma";
import { ensureProjectMember } from "@/lib/projects/membership";
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
    select: { id: true, name: true, managers: { select: { id: true } }, allowsLeadRole: true },
  });
  if (!department || !canManageDepartment(session.user, department)) {
    throw new Error("Недостаточно прав");
  }
  if (!department.allowsLeadRole) {
    throw new Error("В этом департаменте роль Ведущего архитектора не включена");
  }
  if (leadUserId === employeeId) {
    throw new Error("Сотрудник не может быть собственным Ведущим архитектором");
  }
  // Руководитель департамента сам назначает Лидов и распределяет команду —
  // он никогда не подчиняется кому-то другому в этом же экшене (по прямой
  // просьбе Камилы, 2026-07-31). Но "подчиняется руководителю" для ОБЫЧНОГО
  // сотрудника — это ровно то, как сотрудник/Лид "прикрепляется" к ветке
  // конкретного руководителя (см. targetIsManager ниже), это НЕ то же
  // самое, что "стать Лидом", и должно быть разрешено.
  const managerIds = new Set(department.managers.map((m) => m.id));
  if (managerIds.has(employeeId)) {
    throw new Error("Руководитель департамента не может быть чьим-то подчинённым");
  }

  // Выбранная цель — либо конкретный руководитель (сотрудник "прикрепляется"
  // к его ветке и может позже стать Лидом, если ему назначат команду), либо
  // уже действующий Лид (сотрудник входит в его команду).
  const targetIsManager = leadUserId ? managerIds.has(leadUserId) : false;

  if (leadUserId && !targetIsManager) {
    const lead = await prisma.user.findUnique({
      where: { id: leadUserId },
      select: { homeDepartmentId: true, reportsToId: true },
    });
    if (!lead || lead.homeDepartmentId !== department.id) {
      throw new Error("Ведущий архитектор должен состоять в том же департаменте");
    }
    // Ограничение в 2 уровня (Руководитель → Лид → Сотрудник) — Лидом
    // можно назначить только того, кто сам уже закреплён за одним из
    // руководителей (см. выше), а не за другим Лидом — иначе цепочка
    // получилась бы длиннее 2 уровней.
    if (!lead.reportsToId || !managerIds.has(lead.reportsToId)) {
      throw new Error(
        "Сначала закрепите этого сотрудника за руководителем — Ведущим архитектором можно сделать только того, кто уже подчиняется руководителю напрямую",
      );
    }
    // Обратная сторона того же ограничения: сотрудника, у которого уже
    // ЕСТЬ своя команда (сам Лид), нельзя перевести в команду ДРУГОГО
    // Лида — сначала нужно переназначить всех сотрудников его команды
    // (переподчинить его самого руководителю — можно, он просто останется
    // Лидом, но уже у другого руководителя).
    const employeeHasReports = await prisma.user.count({ where: { reportsToId: employeeId } });
    if (employeeHasReports > 0) {
      throw new Error("Этот сотрудник сам руководит другими — сначала переназначьте сотрудников его команды");
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
      isOverride:
        isPrivilegedOverride(session.user) &&
        !department.managers.some((manager) => manager.id === session.user.id),
    });

    // Уведомления "вы назначены/сняты с Лида" — только про настоящих
    // Лидов, не про руководителей (прикрепление сотрудника напрямую к
    // руководителю — не повышение в Лиды).
    if (leadUserId && !targetIsManager) {
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

    if (previousLeadId && !managerIds.has(previousLeadId)) {
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

// Назначение исполнителя задачи Ведущим архитектором (Task 5.2/5.4) — узкое
// отдельное действие, а не расширение canManageProjectTasks: право есть
// только у того, кто вообще Ведущий архитектор (есть хотя бы один прямой
// подчинённый), но назначить можно ЛЮБОГО сотрудника платформы (2026-08-06,
// по прямой просьбе — раньше список ограничивался своей командой). Не
// редактирует название/приоритет/срок — это остаётся у руководителя
// департамента/администратора. Если у вызывающего и так есть полное право
// на задачи раздела (canManageProjectTasks), эта функция не нужна —
// используется updateTaskAction.
export async function leadAssignTaskAction(taskId: string, assigneeUserId: string | null) {
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
          department: { select: { id: true, managers: { select: { id: true } } } },
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
    const reportCount = await prisma.user.count({ where: { reportsToId: session.user.id } });
    if (reportCount === 0) {
      throw new Error("Недостаточно прав для назначения исполнителя");
    }
  }

  const assignee = assigneeUserId
    ? await prisma.user.findUnique({
        where: { id: assigneeUserId },
        select: { id: true, email: true, fullName: true },
      })
    : null;
  if (assigneeUserId && !assignee) {
    throw new Error("Сотрудник не найден");
  }

  await prisma.$transaction(async (tx) => {
    let assigneeMemberId: string | null = null;
    if (assigneeUserId) {
      const { member } = await ensureProjectMember(tx, {
        projectId: task.section.projectId,
        userId: assigneeUserId,
        role: ProjectRole.ИНЖЕНЕР,
        actorId: session.user.id,
        projectName: task.section.project.name,
      });
      assigneeMemberId = member.id;
    }

    await tx.task.update({ where: { id: taskId }, data: { assigneeMemberId } });

    await logActivity(tx, {
      projectId: task.section.projectId,
      actorId: session.user.id,
      message: assignee
        ? `${session.user.name} назначил(а) ${assignee.fullName} исполнителем задачи «${task.title}»`
        : `${session.user.name} снял(а) исполнителя с задачи «${task.title}»`,
    });

    if (assignee) {
      await notifyTaskAssigned(tx, {
        userId: assignee.id,
        actorId: session.user.id,
        taskId: task.id,
        taskTitle: task.title,
        projectName: task.section.project.name,
      });
    }
  });

  revalidatePath(`/projects/${task.section.projectId}`);
}
