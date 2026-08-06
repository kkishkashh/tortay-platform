import { ProjectStatus, TaskStatus } from "@prisma/client";

import type { DepartmentDashboardStats } from "@/lib/departments/queries";
import { prisma } from "@/lib/prisma";
import { workloadLevel } from "@/lib/workload";

// "Быть Ведущим архитектором" — явное назначение (см. prisma/schema.prisma,
// User.leadOfManagerId), а не производное от наличия подчинённых (до
// 2026-08-06 было наоборот — человек становился Лидом только когда у него
// появлялся первый подчинённый).
export async function isLead(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { leadOfManagerId: true } });
  return !!user?.leadOfManagerId;
}

// Лид ИМЕННО этого департамента (не Лид вообще где-то ещё) — используется
// для права менять срок раздела (см. lib/projects/actions.ts::
// updateSectionDatesAction, по прямой просьбе Камилы: "любой из
// руководителей и лид могут в любой момент изменить срок").
export async function isLeadOfDepartment(userId: string, departmentId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { homeDepartmentId: true } });
  if (user?.homeDepartmentId !== departmentId) return false;
  return isLead(userId);
}

// Прямые подчинённые этого Лида — используется и для скоупа задач
// (Task 5.2/5.4, см. lib/leads/actions.ts::leadAssignTaskAction), и для
// Лид-дашборда (getLeadDashboardStats ниже).
export async function getLeadReportIds(leadUserId: string): Promise<string[]> {
  const reports = await prisma.user.findMany({
    where: { reportsToId: leadUserId },
    select: { id: true },
  });
  return reports.map((r) => r.id);
}

export type DepartmentHierarchyNode = {
  id: string;
  fullName: string;
  position: string | null;
};

export type DepartmentHierarchyLead = DepartmentHierarchyNode & {
  reports: DepartmentHierarchyNode[];
};

export type DepartmentHierarchyManager = DepartmentHierarchyNode & {
  // Лиды, которые подчиняются ИМЕННО этому руководителю (reportsToId = id
  // этого руководителя, и у самого Лида есть хотя бы один подчинённый).
  leads: DepartmentHierarchyLead[];
  // Сотрудники, подчиняющиеся напрямую этому руководителю, минуя Лида
  // (reportsToId = id этого руководителя, но своих подчинённых у них нет).
  directReports: DepartmentHierarchyNode[];
};

export type DepartmentHierarchy = {
  // С 2026-07-31 у департамента может быть несколько руководителей, и у
  // каждого — СВОИ Лиды и своя команда (не общий пул на весь департамент).
  managers: DepartmentHierarchyManager[];
  // Сотрудники, которых ещё не привязали ни к одному руководителю
  // (reportsToId === null) — ждут, когда их распределят.
  unassigned: DepartmentHierarchyNode[];
};

// Вкладка "Структура" на странице департамента (Task 5.1, переработано
// 2026-07-31 по прямой просьбе Камилы: "у каждого из 3 руководителей может
// быть по несколько Лидов, и под Лидами — сотрудники", а не общий для
// всего департамента пул Лидов) — Руководители → СВОИ Лиды → их команды,
// плюс отдельно те, кого ещё не распределили (см.
// app/(dashboard)/departments/[id]/hierarchy-tab.tsx).
export async function getDepartmentHierarchy(departmentId: string): Promise<DepartmentHierarchy> {
  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    select: {
      managers: {
        select: { id: true, fullName: true, position: true },
        orderBy: { fullName: "asc" },
      },
      employees: {
        select: {
          id: true,
          fullName: true,
          position: true,
          reportsToId: true,
          leadOfManagerId: true,
        },
        orderBy: { fullName: "asc" },
      },
    },
  });
  if (!department) {
    return { managers: [], unassigned: [] };
  }

  // Руководитель департамента не может быть Ведущим архитектором (по прямой
  // просьбе Камилы, 2026-07-31: руководитель САМ выбирает Ведущих
  // архитекторов и распределяет по ним сотрудников) — исключаем
  // руководителей из пула рядовых сотрудников: они уже показаны отдельными
  // блоками выше.
  const managerIds = new Set(department.managers.map((m) => m.id));
  const rankAndFile = department.employees.filter((e) => !managerIds.has(e.id));

  // Ведущие архитекторы — по явному leadOfManagerId (2026-08-06), а НЕ по
  // наличию подчинённых: блок появляется сразу при назначении, даже с 0
  // сотрудников в команде (см. схему, promoteToLeadAction). Их исключаем
  // из "обычных" сотрудников до группировки по reportsToId, иначе Ведущий
  // архитектор без явного reportsToId мог бы попасть в "Ещё не
  // распределены" вместо своего блока.
  const leadEmployees = rankAndFile.filter((e) => e.leadOfManagerId !== null);
  const plainEmployees = rankAndFile.filter((e) => e.leadOfManagerId === null);

  // Кто кому подчиняется среди ОБЫЧНЫХ сотрудников — группировка по
  // reportsToId (указывает на руководителя или на id Ведущего архитектора,
  // 2 уровня глубины: Руководитель → Ведущий архитектор → Сотрудник, см.
  // lib/leads/actions.ts).
  const reportsByParentId = new Map<string, typeof plainEmployees>();
  for (const e of plainEmployees) {
    if (e.reportsToId === null) continue;
    const arr = reportsByParentId.get(e.reportsToId) ?? [];
    arr.push(e);
    reportsByParentId.set(e.reportsToId, arr);
  }
  const toNode = (e: (typeof rankAndFile)[number]): DepartmentHierarchyNode => ({
    id: e.id,
    fullName: e.fullName,
    position: e.position,
  });

  const managers: DepartmentHierarchyManager[] = department.managers.map((manager) => {
    const leads: DepartmentHierarchyLead[] = leadEmployees
      .filter((e) => e.leadOfManagerId === manager.id)
      .map((lead) => ({ ...toNode(lead), reports: (reportsByParentId.get(lead.id) ?? []).map(toNode) }));
    const directReports = (reportsByParentId.get(manager.id) ?? []).map(toNode);
    return { id: manager.id, fullName: manager.fullName, position: manager.position, leads, directReports };
  });

  const unassigned = plainEmployees.filter((e) => e.reportsToId === null).map(toNode);

  return {
    managers,
    unassigned,
  };
}

// Та же форма, что и DepartmentDashboardStats (см. lib/departments/queries.ts)
// — переиспользуем DepartmentManagerDashboard как есть для Лида (Task 5.3:
// "same component structure, different scope function, not a rewrite"),
// просто считаем эти же цифры по подчинённым Лида (reportsToId), а не по
// всему департаменту.
export async function getLeadDashboardStats(leadUserId: string): Promise<DepartmentDashboardStats> {
  const reportIds = await getLeadReportIds(leadUserId);
  if (reportIds.length === 0) {
    return {
      employeesCount: 0,
      projectsCount: 0,
      activeTasksCount: 0,
      completedTasksCount: 0,
      overdueTasksCount: 0,
      pendingReviewCount: 0,
      taskStatusBreakdown: [],
      recentActivity: [],
    };
  }

  const tasks = await prisma.task.findMany({
    where: { assigneeMember: { userId: { in: reportIds } } },
    select: { status: true, deadline: true, section: { select: { projectId: true } } },
  });
  const now = new Date();

  const activeTasksCount = tasks.filter((t) => t.status !== TaskStatus.ВЫПОЛНЕНО).length;
  const completedTasksCount = tasks.filter((t) => t.status === TaskStatus.ВЫПОЛНЕНО).length;
  const overdueTasksCount = tasks.filter(
    (t) => t.deadline !== null && t.deadline < now && t.status !== TaskStatus.ВЫПОЛНЕНО,
  ).length;
  const pendingReviewCount = tasks.filter((t) => t.status === TaskStatus.НА_ПРОВЕРКЕ).length;

  const breakdownMap = new Map<TaskStatus, number>();
  for (const task of tasks) {
    breakdownMap.set(task.status, (breakdownMap.get(task.status) ?? 0) + 1);
  }
  const taskStatusBreakdown = [
    TaskStatus.НОВАЯ,
    TaskStatus.В_РАБОТЕ,
    TaskStatus.НА_ПРОВЕРКЕ,
    TaskStatus.ВЫПОЛНЕНО,
  ]
    .map((status) => ({ status, count: breakdownMap.get(status) ?? 0 }))
    .filter((item) => item.count > 0);

  const projectsCount = new Set(tasks.map((t) => t.section.projectId)).size;

  // Активность — best-effort, как и у DepartmentDashboardStats: события,
  // где действующее лицо — один из подчинённых Лида.
  const recentActivity = await prisma.activityLog.findMany({
    where: { actorId: { in: reportIds } },
    select: { id: true, message: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  return {
    employeesCount: reportIds.length,
    projectsCount,
    activeTasksCount,
    completedTasksCount,
    overdueTasksCount,
    pendingReviewCount,
    taskStatusBreakdown,
    recentActivity,
  };
}

// Аналог lib/dashboard/queries.ts::getDepartmentEmployeeWorkload, но
// скоупится по подчинённым Лида, а не по департаменту целиком.
export async function getLeadEmployeeWorkload(leadUserId: string, departmentCode?: string | null) {
  const reportIds = await getLeadReportIds(leadUserId);
  if (reportIds.length === 0) return [];

  const [employees, activeMemberships] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: reportIds } }, select: { id: true, fullName: true } }),
    prisma.projectMember.findMany({
      where: { userId: { in: reportIds }, project: { status: ProjectStatus.В_РАБОТЕ } },
      select: { userId: true },
    }),
  ]);

  const countByUserId = new Map<string, number>();
  for (const membership of activeMemberships) {
    countByUserId.set(membership.userId, (countByUserId.get(membership.userId) ?? 0) + 1);
  }

  return employees
    .map((employee) => {
      const activeProjectsCount = countByUserId.get(employee.id) ?? 0;
      return {
        id: employee.id,
        fullName: employee.fullName,
        activeProjectsCount,
        level: workloadLevel(activeProjectsCount, departmentCode),
      };
    })
    .sort((a, b) => b.activeProjectsCount - a.activeProjectsCount);
}
