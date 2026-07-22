import { ProjectStatus, SystemRole, TaskStatus, UserType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { canManageDepartments } from "@/lib/departments/permissions";

export type DepartmentListItem = {
  id: string;
  name: string;
  code: string;
  color: string;
  icon: string;
  description: string | null;
  managerId: string | null;
  managerName: string | null;
  employeesCount: number;
  sectionsCount: number;
  taskStackCount: number;
};

export async function getDepartments(): Promise<DepartmentListItem[]> {
  const departments = await prisma.department.findMany({
    orderBy: { orderIndex: "asc" },
    include: {
      manager: { select: { fullName: true } },
      _count: { select: { employees: true, sections: true, taskTemplateItems: true } },
    },
  });

  return departments.map((department) => ({
    id: department.id,
    name: department.name,
    code: department.code,
    color: department.color,
    icon: department.icon,
    description: department.description,
    managerId: department.managerId,
    managerName: department.manager?.fullName ?? null,
    employeesCount: department._count.employees,
    sectionsCount: department._count.sections,
    taskStackCount: department._count.taskTemplateItems,
  }));
}

export type DepartmentDetail = {
  id: string;
  name: string;
  code: string;
  color: string;
  icon: string;
  description: string | null;
  managerId: string | null;
  managerName: string | null;
  employees: { id: string; fullName: string; position: string | null }[];
};

export async function getDepartmentById(id: string): Promise<DepartmentDetail | null> {
  const department = await prisma.department.findUnique({
    where: { id },
    include: {
      manager: { select: { fullName: true } },
      employees: {
        select: { id: true, fullName: true, position: true },
        orderBy: { fullName: "asc" },
      },
    },
  });
  if (!department) return null;

  return {
    id: department.id,
    name: department.name,
    code: department.code,
    color: department.color,
    icon: department.icon,
    description: department.description,
    managerId: department.managerId,
    managerName: department.manager?.fullName ?? null,
    employees: department.employees,
  };
}

export type DepartmentTaskStackSubItem = {
  id: string;
  title: string;
  description: string | null;
  orderIndex: number;
};

export type DepartmentTaskStackItem = DepartmentTaskStackSubItem & {
  subItems: DepartmentTaskStackSubItem[];
};

// Только пункты верхнего уровня (parentItemId: null) — их подпункты
// вложены в subItems. Глубина ограничена 2 уровнями (см. план), поэтому
// subItems сами дальше не разворачиваются.
export async function getDepartmentTaskStack(
  departmentId: string,
): Promise<DepartmentTaskStackItem[]> {
  return prisma.departmentTaskTemplateItem.findMany({
    where: { departmentId, parentItemId: null },
    select: {
      id: true,
      title: true,
      description: true,
      orderIndex: true,
      subItems: {
        select: { id: true, title: true, description: true, orderIndex: true },
        orderBy: { orderIndex: "asc" },
      },
    },
    orderBy: { orderIndex: "asc" },
  });
}

// Сотрудники, которых можно привязать к департаменту — все штатные
// пользователи, независимо от того, состоят ли они уже в другом
// департаменте (можно перепривязать, addEmployeeToDepartmentAction сам
// переносит из старого департамента в новый). Руководители департаментов
// сюда не входят — их самих в чужой департамент рядовым сотрудником не
// добавляют.
export async function getEmployeesForDepartmentAssignment() {
  return prisma.user.findMany({
    where: { userType: UserType.ШТАТНЫЙ, managedDepartments: { none: {} } },
    select: { id: true, fullName: true, homeDepartmentId: true },
    orderBy: { fullName: "asc" },
  });
}

// Все департаменты + их базовый стек задач — источник для пикера при
// создании проекта (см. Phase 3). Доступен любому, кто уже видит форму
// создания проекта (сама форма admin-only на уровне страницы).
// employees/manager добавлены в Phase 13 (мастер создания проекта): шаг 3
// (контакт по департаменту по умолчанию = реальный руководитель) и шаг 5
// (исполнитель задачи выбирается только из сотрудников ЭТОГО департамента —
// см. план, D9).
export async function getDepartmentsWithTaskStackForProjectCreation() {
  return prisma.department.findMany({
    orderBy: { orderIndex: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
      color: true,
      icon: true,
      manager: { select: { id: true, fullName: true } },
      employees: {
        select: { id: true, fullName: true },
        orderBy: { fullName: "asc" },
      },
      // Только верхнего уровня — их подпункты (чек-лист) вложены в subItems,
      // сами дальше не разворачиваются (см. план, 2 уровня максимум).
      taskTemplateItems: {
        where: { parentItemId: null },
        select: {
          id: true,
          title: true,
          description: true,
          subItems: {
            select: { id: true, title: true, description: true },
            orderBy: { orderIndex: "asc" },
          },
        },
        orderBy: { orderIndex: "asc" },
      },
    },
  });
}

// Департамент, которым руководит этот пользователь (обычно 0-1) — общий
// хелпер для скоуп-проверок в lib/employees/actions.ts (создание/
// редактирование/удаление сотрудников в СВОЁМ департаменте, см. план
// "полный контроль над своим департаментом").
export async function getManagedDepartment(userId: string) {
  return prisma.department.findFirst({
    where: { managerId: userId },
    select: { id: true, name: true },
  });
}

export type RoleTier = "admin" | "department_manager" | "employee";

// Определяет, какой из трёх дашбордов/меню показать (см. app/(dashboard)/
// page.tsx и components/layout/sidebar.tsx). "Руководитель департамента" —
// это не отдельная SystemRole (см. lib/departments/permissions.ts), а
// производный статус: есть ли департамент, где managerId = этот
// пользователь.
export async function getCurrentUserRoleTier(
  user: { id: string; systemRole: SystemRole } | undefined,
): Promise<RoleTier> {
  if (!user) return "employee";
  if (canManageDepartments(user)) return "admin";

  const managed = await prisma.department.findFirst({
    where: { managerId: user.id },
    select: { id: true },
  });
  return managed ? "department_manager" : "employee";
}

export type DepartmentDashboardStats = {
  employeesCount: number;
  projectsCount: number;
  activeTasksCount: number;
  completedTasksCount: number;
  overdueTasksCount: number;
  pendingReviewCount: number;
  taskStatusBreakdown: { status: TaskStatus; count: number }[];
  recentActivity: { id: string; message: string; createdAt: Date }[];
};

// Дашборд руководителя департамента и вкладка "Аналитика" на странице
// департамента используют одни и те же цифры — считаем один раз здесь.
// Активность — best-effort: ActivityLog не привязан к департаменту
// напрямую (только к проекту), поэтому берём события по проектам, где у
// департамента есть хотя бы один раздел — приближение, а не точный
// департаментский фильтр (см. план, Phase 7).
export async function getDepartmentDashboardStats(
  departmentId: string,
): Promise<DepartmentDashboardStats> {
  const [employeesCount, sections] = await Promise.all([
    prisma.user.count({ where: { homeDepartmentId: departmentId } }),
    prisma.section.findMany({
      where: { departmentId },
      select: {
        projectId: true,
        tasks: { select: { status: true, deadline: true } },
      },
    }),
  ]);

  const projectIds = Array.from(new Set(sections.map((s) => s.projectId)));
  const allTasks = sections.flatMap((s) => s.tasks);
  const now = new Date();

  const activeTasksCount = allTasks.filter((t) => t.status !== TaskStatus.ВЫПОЛНЕНО).length;
  const completedTasksCount = allTasks.filter((t) => t.status === TaskStatus.ВЫПОЛНЕНО).length;
  const overdueTasksCount = allTasks.filter(
    (t) => t.deadline !== null && t.deadline < now && t.status !== TaskStatus.ВЫПОЛНЕНО,
  ).length;
  const pendingReviewCount = allTasks.filter((t) => t.status === TaskStatus.НА_ПРОВЕРКЕ).length;

  const breakdownMap = new Map<TaskStatus, number>();
  for (const task of allTasks) {
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

  const recentActivity =
    projectIds.length > 0
      ? await prisma.activityLog.findMany({
          where: { projectId: { in: projectIds } },
          select: { id: true, message: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 8,
        })
      : [];

  return {
    employeesCount,
    projectsCount: projectIds.length,
    activeTasksCount,
    completedTasksCount,
    overdueTasksCount,
    pendingReviewCount,
    taskStatusBreakdown,
    recentActivity,
  };
}

export type DepartmentProjectItem = {
  id: string;
  name: string;
  status: ProjectStatus;
  sectionName: string;
  tasksCount: number;
  completedTasksCount: number;
};

// Проекты, где у департамента есть хотя бы один раздел — для вкладки
// "Проекты" на странице департамента.
export async function getDepartmentProjects(departmentId: string): Promise<DepartmentProjectItem[]> {
  const sections = await prisma.section.findMany({
    where: { departmentId },
    select: {
      name: true,
      project: { select: { id: true, name: true, status: true, createdAt: true } },
      tasks: { select: { status: true } },
    },
    orderBy: { project: { createdAt: "desc" } },
  });

  return sections.map((section) => ({
    id: section.project.id,
    name: section.project.name,
    status: section.project.status,
    sectionName: section.name,
    tasksCount: section.tasks.length,
    completedTasksCount: section.tasks.filter((t) => t.status === TaskStatus.ВЫПОЛНЕНО).length,
  }));
}
