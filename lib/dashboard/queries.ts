import { PaymentStatus, ProjectStatus, SystemRole, UserType } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { workloadLevel, type WorkloadLevel } from "@/lib/workload";

export type DashboardStats = {
  activeProjectsCount: number;
  employeesCount: number;
  completedThisYearCount: number;
  // null означает "скрыто" — финансовые суммы видит только РУКОВОДИТЕЛЬ.
  pendingPaymentsTotal: number | null;
};

// Показатели дашборда считаются в той же зоне видимости, что и список
// проектов (см. getProjectsForCurrentUser): РУКОВОДИТЕЛЬ видит компанию
// целиком, СОТРУДНИК — только проекты, где сам состоит участником.
export async function getDashboardStats(): Promise<DashboardStats> {
  const session = await auth();
  if (!session?.user) {
    return {
      activeProjectsCount: 0,
      employeesCount: 0,
      completedThisYearCount: 0,
      pendingPaymentsTotal: null,
    };
  }

  const isHead = session.user.systemRole === SystemRole.РУКОВОДИТЕЛЬ;
  const projectScope = isHead
    ? undefined
    : { members: { some: { userId: session.user.id } } };

  const startOfYear = new Date(new Date().getFullYear(), 0, 1);
  const startOfNextYear = new Date(new Date().getFullYear() + 1, 0, 1);

  const [activeProjectsCount, employeesCount, completedThisYearCount, pendingPayments] =
    await Promise.all([
      prisma.project.count({
        where: { ...projectScope, status: ProjectStatus.В_РАБОТЕ },
      }),
      prisma.user.count({ where: { userType: UserType.ШТАТНЫЙ } }),
      prisma.project.count({
        where: {
          ...projectScope,
          status: ProjectStatus.ЗАВЕРШЁН_ПОЛНОСТЬЮ,
          completedAt: { gte: startOfYear, lt: startOfNextYear },
        },
      }),
      // Финансовые данные — только для РУКОВОДИТЕЛЯ.
      isHead
        ? prisma.payment.aggregate({
            where: { status: PaymentStatus.ОЖИДАЕТСЯ },
            _sum: { amount: true },
          })
        : null,
    ]);

  return {
    activeProjectsCount,
    employeesCount,
    completedThisYearCount,
    pendingPaymentsTotal: pendingPayments
      ? Number(pendingPayments._sum.amount ?? 0)
      : null,
  };
}

export type { WorkloadLevel };

export type EmployeeWorkload = {
  id: string;
  fullName: string;
  activeProjectsCount: number;
  level: WorkloadLevel;
};

export async function getEmployeeWorkload(): Promise<EmployeeWorkload[]> {
  const [employees, activeMemberships] = await Promise.all([
    prisma.user.findMany({
      where: { userType: UserType.ШТАТНЫЙ },
      select: { id: true, fullName: true },
    }),
    prisma.projectMember.findMany({
      where: { project: { status: ProjectStatus.В_РАБОТЕ } },
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

export type ActivityItem = {
  id: string;
  message: string;
  createdAt: Date;
};

// Та же зона видимости, что и у остальных показателей дашборда:
// РУКОВОДИТЕЛЬ видит события по всей компании, СОТРУДНИК — только по
// проектам, где сам состоит участником.
export async function getRecentActivity(limit = 8): Promise<ActivityItem[]> {
  const session = await auth();
  if (!session?.user) {
    return [];
  }

  const isHead = session.user.systemRole === SystemRole.РУКОВОДИТЕЛЬ;

  const entries = await prisma.activityLog.findMany({
    where: isHead
      ? undefined
      : { project: { members: { some: { userId: session.user.id } } } },
    select: { id: true, message: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return entries;
}

export type UpcomingPayment = {
  id: string;
  projectName: string;
  contractNumber: string | null;
  dueDate: Date | null;
  amount: number;
  isOverdue: boolean;
};

// Финансовые данные — только для РУКОВОДИТЕЛЯ, как и pendingPaymentsTotal
// в getDashboardStats(): отдельной финансовой роли в проекте пока нет.
export async function getUpcomingPayments(limit = 6): Promise<UpcomingPayment[]> {
  const session = await auth();
  if (!session?.user || session.user.systemRole !== SystemRole.РУКОВОДИТЕЛЬ) {
    return [];
  }

  const payments = await prisma.payment.findMany({
    where: { status: PaymentStatus.ОЖИДАЕТСЯ },
    include: { contract: { include: { project: { select: { name: true } } } } },
  });

  const now = new Date();

  return payments
    .map((payment) => ({
      id: payment.id,
      projectName: payment.contract.project.name,
      contractNumber: payment.contract.number,
      dueDate: payment.dueDate,
      amount: Number(payment.amount),
      isOverdue: payment.dueDate !== null && payment.dueDate < now,
    }))
    .sort((a, b) => {
      // Без срока — в конец списка: неизвестный срок не значит "скоро".
      if (a.dueDate === null && b.dueDate === null) return 0;
      if (a.dueDate === null) return 1;
      if (b.dueDate === null) return -1;
      return a.dueDate.getTime() - b.dueDate.getTime();
    })
    .slice(0, limit);
}

export type ProjectStatusBreakdownItem = {
  status: ProjectStatus;
  count: number;
};

// Для донат-чарта "Проекты по статусу" на дашборде — та же зона
// видимости, что и у остального дашборда.
export async function getProjectStatusBreakdown(): Promise<ProjectStatusBreakdownItem[]> {
  const session = await auth();
  if (!session?.user) {
    return [];
  }

  const isHead = session.user.systemRole === SystemRole.РУКОВОДИТЕЛЬ;
  const projectScope = isHead
    ? undefined
    : { members: { some: { userId: session.user.id } } };

  const grouped = await prisma.project.groupBy({
    by: ["status"],
    where: projectScope,
    _count: { _all: true },
  });

  const countByStatus = new Map(grouped.map((g) => [g.status, g._count._all]));

  return [
    ProjectStatus.В_РАБОТЕ,
    ProjectStatus.ЗАВЕРШЁН_ПО_РАЗДЕЛАМ,
    ProjectStatus.ЗАВЕРШЁН_ПОЛНОСТЬЮ,
  ]
    .map((status) => ({ status, count: countByStatus.get(status) ?? 0 }))
    .filter((item) => item.count > 0);
}

export type UpcomingDeadline = {
  sectionId: string;
  sectionName: string;
  projectId: string;
  projectName: string;
  deadline: Date;
};

// "Дедлайны на этой неделе" — реальные сроки РАЗДЕЛОВ (не выдуманные
// задачи, см. обсуждение при редизайне: Task/Document ещё без CRUD),
// та же зона видимости, что и у остального дашборда.
export async function getUpcomingDeadlines(daysAhead = 7): Promise<UpcomingDeadline[]> {
  const session = await auth();
  if (!session?.user) {
    return [];
  }

  const isHead = session.user.systemRole === SystemRole.РУКОВОДИТЕЛЬ;
  const projectScope = isHead
    ? undefined
    : { members: { some: { userId: session.user.id } } };

  const now = new Date();
  const until = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const sections = await prisma.section.findMany({
    where: {
      project: projectScope,
      deadline: { gte: now, lte: until },
      status: { not: "ВЫПОЛНЕНО" },
    },
    select: {
      id: true,
      name: true,
      deadline: true,
      project: { select: { id: true, name: true } },
    },
    orderBy: { deadline: "asc" },
  });

  return sections
    .filter((section): section is typeof section & { deadline: Date } => section.deadline !== null)
    .map((section) => ({
      sectionId: section.id,
      sectionName: section.name,
      projectId: section.project.id,
      projectName: section.project.name,
      deadline: section.deadline,
    }));
}

export type ProjectTimeline = {
  id: string;
  name: string;
  startDate: Date;
  deadline: Date;
};

// По архитектуре (бриф, п.7) Гант — не отдельная таблица, а визуализация
// startDate/deadline разделов: диапазон проекта = от самого раннего начала
// до самого позднего срока среди его разделов. Проекты, где ни у одного
// раздела не заданы обе даты, в Гант не попадают — рисовать отрезок не из
// чего.
export async function getProjectTimelines(): Promise<ProjectTimeline[]> {
  const session = await auth();
  if (!session?.user) {
    return [];
  }

  const isHead = session.user.systemRole === SystemRole.РУКОВОДИТЕЛЬ;
  const projectScope = isHead
    ? undefined
    : { members: { some: { userId: session.user.id } } };

  const projects = await prisma.project.findMany({
    where: projectScope,
    select: {
      id: true,
      name: true,
      sections: { select: { startDate: true, deadline: true } },
    },
  });

  const timelines: ProjectTimeline[] = [];
  for (const project of projects) {
    const starts = project.sections
      .map((section) => section.startDate)
      .filter((date): date is Date => date !== null);
    const deadlines = project.sections
      .map((section) => section.deadline)
      .filter((date): date is Date => date !== null);

    if (starts.length === 0 || deadlines.length === 0) continue;

    const startDate = new Date(Math.min(...starts.map((date) => date.getTime())));
    const deadline = new Date(Math.max(...deadlines.map((date) => date.getTime())));
    if (deadline < startDate) continue;

    timelines.push({ id: project.id, name: project.name, startDate, deadline });
  }

  return timelines.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
}
