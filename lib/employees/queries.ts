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
      activeProjectsCount,
      completedProjectsCount,
      totalProjectsCount: statuses.length,
      workload: workloadLevel(activeProjectsCount),
    };
  });
}

export async function getEmployeeById(id: string) {
  return prisma.user.findUnique({
    where: { id, userType: UserType.ШТАТНЫЙ },
    select: {
      id: true,
      fullName: true,
      email: true,
      systemRole: true,
      phone: true,
      position: true,
      birthDate: true,
    },
  });
}
