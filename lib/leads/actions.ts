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

// Задаёт employee.reportsToId — "прикрепляет" сотрудника к ветке
// руководителя ИЛИ уже назначенного Ведущего архитектора (см.
// promoteToLeadAction ниже — назначение самого статуса "Ведущий архитектор"
// вынесено в отдельное явное действие, 2026-08-06, по прямой просьбе; эта
// функция больше НЕ создаёт Ведущих архитекторов неявно первым подчинённым).
// Обычно — руководитель ЭТОГО департамента/администратор, но при
// leadUserId === сам вызывающий разрешено и самому Ведущему архитектору —
// формировать СВОЮ команду (см. isSelfServiceLead ниже), не трогая чужие
// блоки. Только если Department.allowsLeadRole включён (см.
// app/(dashboard)/departments/[id]/settings-tab.tsx).
export async function setEmployeeLeadAction(employeeId: string, leadUserId: string | null) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  const employee = await prisma.user.findUnique({
    where: { id: employeeId },
    select: { id: true, fullName: true, homeDepartmentId: true, reportsToId: true, leadOfManagerId: true },
  });
  if (!employee?.homeDepartmentId) {
    throw new Error("У сотрудника нет департамента");
  }

  const department = await prisma.department.findUnique({
    where: { id: employee.homeDepartmentId },
    select: { id: true, name: true, managers: { select: { id: true } }, allowsLeadRole: true },
  });
  if (!department) {
    throw new Error("Недостаточно прав");
  }

  const managerIds = new Set(department.managers.map((m) => m.id));
  const canManage = canManageDepartment(session.user, department);

  // Ведущий архитектор формирует ТОЛЬКО свою команду: забрать может либо
  // "ещё не распределённого" (reportsToId === null), либо того, кто сейчас
  // напрямую числится за ЕГО ЖЕ руководителем — а убрать может только
  // своего текущего подчинённого. Чужие блоки (других Ведущих архитекторов
  // или руководителей) так не тронуть.
  let isSelfServiceLead = false;
  if (!canManage) {
    const actingUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { leadOfManagerId: true },
    });
    const isThisDeptLead =
      !!actingUser?.leadOfManagerId && managerIds.has(actingUser.leadOfManagerId);
    if (isThisDeptLead) {
      if (leadUserId === session.user.id) {
        isSelfServiceLead =
          employee.reportsToId === null || employee.reportsToId === actingUser!.leadOfManagerId;
      } else if (leadUserId === null) {
        isSelfServiceLead = employee.reportsToId === session.user.id;
      }
    }
  }
  if (!canManage && !isSelfServiceLead) {
    throw new Error("Недостаточно прав");
  }
  if (!department.allowsLeadRole) {
    throw new Error("В этом департаменте роль Ведущего архитектора не включена");
  }
  if (leadUserId === employeeId) {
    throw new Error("Сотрудник не может быть собственным Ведущим архитектором");
  }
  if (managerIds.has(employeeId)) {
    throw new Error("Руководитель департамента не может быть чьим-то подчинённым");
  }
  // Ведущий архитектор сам не может подчиняться кому-то через это
  // действие — переместить его между руководителями можно только через
  // promoteToLeadAction, снять статус — через demoteLeadAction.
  if (employee.leadOfManagerId) {
    throw new Error(
      "Этот сотрудник сам назначен Ведущим архитектором — используйте переназначение на вкладке «Структура»",
    );
  }

  const targetIsManager = leadUserId ? managerIds.has(leadUserId) : false;

  if (leadUserId && !targetIsManager) {
    const lead = await prisma.user.findUnique({
      where: { id: leadUserId },
      select: { homeDepartmentId: true, leadOfManagerId: true },
    });
    if (!lead || lead.homeDepartmentId !== department.id) {
      throw new Error("Ведущий архитектор должен состоять в том же департаменте");
    }
    if (!lead.leadOfManagerId || !managerIds.has(lead.leadOfManagerId)) {
      throw new Error(
        "Этот сотрудник ещё не назначен Ведущим архитектором — сначала назначьте его на вкладке «Структура»",
      );
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
  });

  revalidatePath(`/departments/${department.id}`);
  revalidatePath(`/employees/${employeeId}`);
}

// Явное назначение "Ведущий архитектор под конкретным руководителем"
// (2026-08-06, по прямой просьбе) — раньше статус был чисто производным
// (появлялся только когда кто-то УЖЕ получал первого подчинённого), из-за
// чего не было способа показать блок Ведущего архитектора до того, как у
// него появится команда. Теперь это отдельное решение руководителя/админа,
// не завязанное на размер команды — тот же вызов используется и для
// ПЕРЕНАЗНАЧЕНИЯ уже действующего Ведущего архитектора другому
// руководителю (idempotent set, не только первое назначение).
export async function promoteToLeadAction(employeeId: string, managerId: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  const employee = await prisma.user.findUnique({
    where: { id: employeeId },
    select: { id: true, homeDepartmentId: true, leadOfManagerId: true },
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
  if (employeeId === managerId) {
    throw new Error("Сотрудник не может быть собственным Ведущим архитектором");
  }
  const managerIds = new Set(department.managers.map((m) => m.id));
  if (managerIds.has(employeeId)) {
    throw new Error("Руководитель департамента не может быть Ведущим архитектором в своём же департаменте");
  }
  if (!managerIds.has(managerId)) {
    throw new Error("Указанный руководитель не управляет этим департаментом");
  }

  if (employee.leadOfManagerId === managerId) return;
  const wasAlreadyLead = employee.leadOfManagerId !== null;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: employeeId }, data: { leadOfManagerId: managerId } });

    if (!wasAlreadyLead) {
      await notifyLeadPromoted(tx, {
        userId: employeeId,
        actorId: session.user.id,
        departmentName: department.name,
      });
    }
  });

  revalidatePath(`/departments/${department.id}`);
  revalidatePath(`/employees/${employeeId}`);
}

// Снятие статуса Ведущего архитектора — только если у него сейчас нет
// подчинённых (сначала переназначьте его команду на вкладке «Структура»,
// тем же способом, что и у обычных сотрудников — см. setEmployeeLeadAction).
export async function demoteLeadAction(employeeId: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  const employee = await prisma.user.findUnique({
    where: { id: employeeId },
    select: { id: true, homeDepartmentId: true, leadOfManagerId: true },
  });
  if (!employee?.homeDepartmentId || !employee.leadOfManagerId) {
    throw new Error("Этот сотрудник не назначен Ведущим архитектором");
  }

  const department = await prisma.department.findUnique({
    where: { id: employee.homeDepartmentId },
    select: { id: true, managers: { select: { id: true } } },
  });
  if (!department || !canManageDepartment(session.user, department)) {
    throw new Error("Недостаточно прав");
  }

  const reportsCount = await prisma.user.count({ where: { reportsToId: employeeId } });
  if (reportsCount > 0) {
    throw new Error("Сначала переназначьте сотрудников его команды");
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: employeeId }, data: { leadOfManagerId: null } });
    await notifyLeadDemoted(tx, { userId: employeeId, actorId: session.user.id });
  });

  revalidatePath(`/departments/${department.id}`);
  revalidatePath(`/employees/${employeeId}`);
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
  // Право есть у любого назначенного Ведущего архитектора (leadOfManagerId),
  // независимо от размера его команды на данный момент.
  if (!canManageProjectTasks(session.user, task.section)) {
    const actingUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { leadOfManagerId: true },
    });
    if (!actingUser?.leadOfManagerId) {
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
