import { ProjectStatus, SystemRole, TaskStatus, UserType } from "@prisma/client";

import { auth } from "@/auth";
import { getCurrentUserRoleTier, getManagedDepartment } from "@/lib/departments/queries";
import { prisma } from "@/lib/prisma";
import { taskWorkloadLevel, workloadLevel, type WorkloadLevel } from "@/lib/workload";

// ГИП — руководящая роль внутри компании, поэтому выбираем только
// штатных сотрудников (аутсорсеров сюда не включаем). Руководители
// департаментов сюда не входят — они теперь отдельная категория (см.
// Account Portal → Менеджеры); сотрудников себе добавляют сами.
export async function getEmployeesForSelect() {
  return prisma.user.findMany({
    where: { userType: UserType.ШТАТНЫЙ, managedDepartments: { none: {} } },
    select: { id: true, fullName: true },
    orderBy: { fullName: "asc" },
  });
}

export type EmployeeListItem = {
  id: string;
  fullName: string;
  email: string;
  systemRole: SystemRole;
  phone: string | null;
  position: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  activeProjectsCount: number;
  completedProjectsCount: number;
  totalProjectsCount: number;
  workload: WorkloadLevel;
};

// Полный список для страницы "Сотрудники" — с проектной статистикой и
// загруженностью (та же логика, что и на дашборде, см. lib/workload.ts).
// Руководители департаментов сюда не входят (managedDepartments: none) —
// это отдельная категория (Account Portal → Менеджеры); они сами
// добавляют сотрудников в свой департамент.
// Область видимости (обновлено по прямой просьбе Камилы про 3 роли):
// администратор видит весь список без изменений; руководитель
// департамента — только сотрудников СВОЕГО департамента плюс самого себя
// (чтобы видеть свою запись в списке, даже хотя managedDepartments у него
// не пустой); рядовой сотрудник — ТОЛЬКО сотрудников своего же
// департамента (раньше видел всю компанию, см. git log — это сознательно
// сузили). Названия ЧУЖИХ департаментов сотрудник по-прежнему видит на
// /departments (см. department-card.tsx — там для не-руководителей только
// имя, без состава).
async function queryEmployeeList(scopeWhere: Record<string, unknown>): Promise<EmployeeListItem[]> {
  const employees = await prisma.user.findMany({
    where: { userType: UserType.ШТАТНЫЙ, ...scopeWhere },
    select: {
      id: true,
      fullName: true,
      email: true,
      systemRole: true,
      phone: true,
      position: true,
      avatarUrl: true,
      isActive: true,
      projectMemberships: {
        select: { project: { select: { status: true } } },
      },
    },
    orderBy: { fullName: "asc" },
  });

  return employees.map((employee) => {
    const statuses = employee.projectMemberships.map((m) => m.project.status);
    const activeProjectsCount = statuses.filter(
      (status) => status === ProjectStatus.В_РАБОТЕ,
    ).length;
    const completedProjectsCount = statuses.filter(
      (status) => status === ProjectStatus.ЗАВЕРШЁН_ПОЛНОСТЬЮ,
    ).length;

    return {
      id: employee.id,
      fullName: employee.fullName,
      email: employee.email,
      systemRole: employee.systemRole,
      phone: employee.phone,
      position: employee.position,
      avatarUrl: employee.avatarUrl,
      isActive: employee.isActive,
      activeProjectsCount,
      completedProjectsCount,
      totalProjectsCount: statuses.length,
      workload: workloadLevel(activeProjectsCount),
    };
  });
}

export async function getEmployees(): Promise<EmployeeListItem[]> {
  const session = await auth();
  const tier = await getCurrentUserRoleTier(session?.user);

  let scopeWhere = {};
  if (tier === "department_manager" && session?.user) {
    const managed = await getManagedDepartment(session.user.id);
    scopeWhere = managed
      ? {
          OR: [
            { managedDepartments: { none: {} }, homeDepartmentId: managed.id },
            { id: session.user.id },
          ],
        }
      : { id: session.user.id };
  } else if (tier === "employee" && session?.user) {
    const me = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { homeDepartmentId: true },
    });
    scopeWhere = me?.homeDepartmentId
      ? { managedDepartments: { none: {} }, homeDepartmentId: me.homeDepartmentId }
      : { id: session.user.id };
  } else {
    scopeWhere = { managedDepartments: { none: {} } };
  }

  return queryEmployeeList(scopeWhere);
}

// Task 2.1/2.2 (PRD #3 Phase 5) — вкладка "Вся компания" на /employees:
// та же выборка, что видит администратор в getEmployees(), но доступна
// ЛЮБОМУ руководителю департамента для ПРОСМОТРА (вызывающий код рендерит
// её в read-only режиме — без кнопок редактирования/архива/сброса
// пароля). Рядовым сотрудникам эта функция не вызывается вообще (страница
// её не запрашивает для их роли) — их видимость остаётся сужена до
// своего департамента, как и раньше.
export async function getCompanyWideEmployees(): Promise<EmployeeListItem[]> {
  return queryEmployeeList({ managedDepartments: { none: {} } });
}

export type EmployeeProfile = {
  id: string;
  fullName: string;
  email: string;
  systemRole: SystemRole;
  phone: string | null;
  position: string | null;
  avatarUrl: string | null;
  birthDate: Date | null;
  createdAt: Date;
  homeDepartmentId: string | null;
  financeAccess: boolean;
  isActive: boolean;
  // Task 4.1 (PRD #3 Phase 3) — "кому подчиняется": сам Лид, если назначен
  // (reportsTo), иначе руководитель домашнего департамента, иначе null
  // (нет ни того, ни другого — департамент без руководителя).
  reportsToName: string | null;
  projectsByStatus: { status: ProjectStatus; projects: { id: string; name: string }[] }[];
  activeProjectsCount: number;
  completedProjectsCount: number;
  totalProjectsCount: number;
  completionRate: number;
  workload: WorkloadLevel;
  // Задачная сторона (Phase 16, D15) — отдельная от проектной workload выше,
  // подписана отдельной карточкой в профиле, не подменяет существующую.
  activeTaskCount: number;
  lateTaskCount: number;
  taskWorkload: WorkloadLevel;
  taskCompletionRate: number;
};

// Порядок реальных статусов проекта — "запланировано" отдельным статусом
// в базе не существует, поэтому личный кабинет группирует по тому, что
// реально есть: В работе / Завершён по разделам / Завершён полностью.
const PROFILE_STATUS_ORDER = [
  ProjectStatus.В_РАБОТЕ,
  ProjectStatus.ЗАВЕРШЁН_ПО_РАЗДЕЛАМ,
  ProjectStatus.ЗАВЕРШЁН_ПОЛНОСТЬЮ,
];

// "Эффективность" — задач (Task) в системе нет, поэтому считаем честно
// по тому, что есть: % завершённых проектов среди всех + текущая
// загрузка (та же логика, что и в getEmployees/дашборде).
export async function getEmployeeProfile(id: string): Promise<EmployeeProfile | null> {
  const user = await prisma.user.findUnique({
    where: { id, userType: UserType.ШТАТНЫЙ },
    select: {
      id: true,
      fullName: true,
      email: true,
      systemRole: true,
      phone: true,
      position: true,
      avatarUrl: true,
      birthDate: true,
      createdAt: true,
      homeDepartmentId: true,
      financeAccess: true,
      isActive: true,
      reportsTo: { select: { fullName: true } },
      homeDepartment: { select: { manager: { select: { fullName: true } } } },
      projectMemberships: {
        select: {
          project: { select: { id: true, name: true, status: true } },
          // Через существующую обратную связь ProjectMember.tasksAssigned —
          // без отдельного запроса к Task (см. план, "reusing already-fetched
          // task data, not re-querying").
          tasksAssigned: { select: { status: true, deadline: true } },
        },
      },
    },
  });
  if (!user) return null;

  const projects = user.projectMemberships.map((m) => m.project);
  const allTasks = user.projectMemberships.flatMap((m) => m.tasksAssigned);
  const now = new Date();
  const activeTaskCount = allTasks.filter((t) => t.status !== TaskStatus.ВЫПОЛНЕНО).length;
  const lateTaskCount = allTasks.filter(
    (t) => t.deadline !== null && t.deadline < now && t.status !== TaskStatus.ВЫПОЛНЕНО,
  ).length;
  const taskCompletionRate =
    allTasks.length === 0
      ? 0
      : Math.round(((allTasks.length - activeTaskCount) / allTasks.length) * 100);
  const projectsByStatus = PROFILE_STATUS_ORDER.map((status) => ({
    status,
    projects: projects
      .filter((project) => project.status === status)
      .map((project) => ({ id: project.id, name: project.name })),
  }));

  const activeProjectsCount = projects.filter(
    (project) => project.status === ProjectStatus.В_РАБОТЕ,
  ).length;
  const completedProjectsCount = projects.filter(
    (project) =>
      project.status === ProjectStatus.ЗАВЕРШЁН_ПО_РАЗДЕЛАМ ||
      project.status === ProjectStatus.ЗАВЕРШЁН_ПОЛНОСТЬЮ,
  ).length;
  const totalProjectsCount = projects.length;

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    systemRole: user.systemRole,
    phone: user.phone,
    position: user.position,
    avatarUrl: user.avatarUrl,
    birthDate: user.birthDate,
    createdAt: user.createdAt,
    homeDepartmentId: user.homeDepartmentId,
    financeAccess: user.financeAccess,
    isActive: user.isActive,
    reportsToName: user.reportsTo?.fullName ?? user.homeDepartment?.manager?.fullName ?? null,
    projectsByStatus,
    activeProjectsCount,
    completedProjectsCount,
    totalProjectsCount,
    completionRate:
      totalProjectsCount === 0
        ? 0
        : Math.round((completedProjectsCount / totalProjectsCount) * 100),
    workload: workloadLevel(activeProjectsCount),
    activeTaskCount,
    lateTaskCount,
    taskWorkload: taskWorkloadLevel(activeTaskCount),
    taskCompletionRate,
  };
}

export type TimelineItem =
  | { kind: "activity"; id: string; message: string; createdAt: Date }
  | {
      kind: "notification";
      id: string;
      title: string;
      body: string;
      isRead: boolean;
      createdAt: Date;
    };

// Вкладка "Таймлайн" в профиле сотрудника (см. план, Phase 16, D16) —
// объединяет ActivityLog (что сотрудник СДЕЛАЛ, actorId = он) и
// Notification (что ПРОИЗОШЛО с ним, userId = он), без парсинга свободного
// текста ActivityLog.message (там нет taskId, чтобы фильтровать надёжно
// по-другому).
export async function getEmployeeTimeline(userId: string, limit = 30): Promise<TimelineItem[]> {
  const [activity, notifications] = await Promise.all([
    prisma.activityLog.findMany({
      where: { actorId: userId },
      select: { id: true, message: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.notification.findMany({
      where: { userId },
      select: { id: true, title: true, body: true, isRead: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
  ]);

  const merged: TimelineItem[] = [
    ...activity.map((a): TimelineItem => ({ kind: "activity", ...a })),
    ...notifications.map((n): TimelineItem => ({ kind: "notification", ...n })),
  ];

  return merged.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
}
