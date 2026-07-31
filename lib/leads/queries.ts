import { ProjectStatus, TaskStatus } from "@prisma/client";

import type { DepartmentDashboardStats } from "@/lib/departments/queries";
import { prisma } from "@/lib/prisma";
import { workloadLevel } from "@/lib/workload";

// "Быть Лидом" — производный статус (см. prisma/schema.prisma, User.reportsTo):
// человек — Лид ровно тогда, когда у кого-то reportsToId указывает на него.
export async function isLead(userId: string): Promise<boolean> {
  const count = await prisma.user.count({ where: { reportsToId: userId } });
  return count > 0;
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

export type DepartmentHierarchy = {
  // С 2026-07-31 может быть несколько руководителей департамента.
  managers: DepartmentHierarchyNode[];
  leads: (DepartmentHierarchyNode & { reports: DepartmentHierarchyNode[] })[];
  // Сотрудники департамента без назначенного Лида — подчиняются
  // напрямую руководителю департамента.
  unassigned: DepartmentHierarchyNode[];
};

// Вкладка "Структура" на странице департамента (Task 5.1) — Руководители →
// Лиды → их подчинённые, плюс отдельно те, кто пока ни к какому Лиду не
// привязан (см. app/(dashboard)/departments/[id]/hierarchy-tab.tsx).
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
        },
        orderBy: { fullName: "asc" },
      },
    },
  });
  if (!department) {
    return { managers: [], leads: [], unassigned: [] };
  }

  const employeeById = new Map(department.employees.map((e) => [e.id, e]));
  // Лид этого департамента — сотрудник, на которого указывает reportsToId
  // хотя бы одного другого сотрудника ЭТОГО ЖЕ департамента (сам Лид
  // сам ни на кого не указывает — см. ограничение 2 уровней в
  // setEmployeeLeadAction).
  const leadIds = new Set(
    department.employees.map((e) => e.reportsToId).filter((id): id is string => id !== null),
  );

  const leads = Array.from(leadIds)
    .map((leadId) => employeeById.get(leadId))
    .filter((lead): lead is NonNullable<typeof lead> => lead !== undefined)
    .map((lead) => ({
      id: lead.id,
      fullName: lead.fullName,
      position: lead.position,
      reports: department.employees
        .filter((e) => e.reportsToId === lead.id)
        .map((e) => ({ id: e.id, fullName: e.fullName, position: e.position })),
    }));

  const unassigned = department.employees
    .filter((e) => e.reportsToId === null && !leadIds.has(e.id))
    .map((e) => ({ id: e.id, fullName: e.fullName, position: e.position }));

  return {
    managers: department.managers,
    leads,
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
export async function getLeadEmployeeWorkload(leadUserId: string) {
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
        level: workloadLevel(activeProjectsCount),
      };
    })
    .sort((a, b) => b.activeProjectsCount - a.activeProjectsCount);
}
