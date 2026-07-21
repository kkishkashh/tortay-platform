import { prisma } from "@/lib/prisma";

export type ManagerListItem = {
  id: string;
  fullName: string;
  email: string;
  username: string | null;
  phone: string | null;
  position: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  departmentId: string | null;
  departmentName: string | null;
};

// "Руководитель" — производное понятие (см. D2, lib/departments/permissions.ts):
// это любой User, управляющий хотя бы одним департаментом (managedDepartments).
// Отдельного признака "менеджер" в схеме нет и не будет.
export async function getManagers(): Promise<ManagerListItem[]> {
  const managers = await prisma.user.findMany({
    where: { managedDepartments: { some: {} } },
    select: {
      id: true,
      fullName: true,
      email: true,
      username: true,
      phone: true,
      position: true,
      avatarUrl: true,
      isActive: true,
      managedDepartments: { select: { id: true, name: true }, take: 1 },
    },
    orderBy: { fullName: "asc" },
  });

  return managers.map((manager) => ({
    id: manager.id,
    fullName: manager.fullName,
    email: manager.email,
    username: manager.username,
    phone: manager.phone,
    position: manager.position,
    avatarUrl: manager.avatarUrl,
    isActive: manager.isActive,
    departmentId: manager.managedDepartments[0]?.id ?? null,
    departmentName: manager.managedDepartments[0]?.name ?? null,
  }));
}
