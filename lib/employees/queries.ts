import { ProjectStatus, SystemRole, UserType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { workloadLevel, type WorkloadLevel } from "@/lib/workload";

// ГИП — руководящая роль внутри компании, поэтому выбираем только
// штатных сотрудников (аутсорсеров сюда не включаем).
export async function getEmployeesForSelect() {
  return prisma.user.findMany({
    where: { userType: UserType.ШТАТНЫЙ },
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
export async function getEmployees(): Promise<EmployeeListItem[]> {
  const employees = await prisma.user.findMany({
    where: { userType: UserType.ШТАТНЫЙ },
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

export type EmployeeProfile = {
  id: string;
  fullName: string;
  email: string;
  systemRole: SystemRole;
  phone: string | null;
  position: string | null;
  avatarUrl: string | null;
  birthDate: Date | null;
  salary: number | null;
  createdAt: Date;
  homeDepartmentId: string | null;
  projectsByStatus: { status: ProjectStatus; projects: { id: string; name: string }[] }[];
  activeProjectsCount: number;
  completedProjectsCount: number;
  totalProjectsCount: number;
  completionRate: number;
  workload: WorkloadLevel;
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
      salary: true,
      createdAt: true,
      homeDepartmentId: true,
      projectMemberships: {
        select: { project: { select: { id: true, name: true, status: true } } },
      },
    },
  });
  if (!user) return null;

  const projects = user.projectMemberships.map((m) => m.project);
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
    salary: user.salary !== null ? Number(user.salary) : null,
    createdAt: user.createdAt,
    homeDepartmentId: user.homeDepartmentId,
    projectsByStatus,
    activeProjectsCount,
    completedProjectsCount,
    totalProjectsCount,
    completionRate:
      totalProjectsCount === 0
        ? 0
        : Math.round((completedProjectsCount / totalProjectsCount) * 100),
    workload: workloadLevel(activeProjectsCount),
  };
}
