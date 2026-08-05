import { ProjectRole } from "@prisma/client";

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
  managedDepartments: { id: string; name: string }[];
  // Для диалога "Убрать из руководителей" (см. remove-from-managers-dialog.tsx) —
  // сразу предложить назначить ГИПом каких-то проектов взамен.
  gipProjectIds: string[];
};

// "Руководитель" — производное понятие (см. D2, lib/departments/permissions.ts):
// это любой User, управляющий хотя бы одним департаментом (managedDepartments).
// Отдельного признака "менеджер" в схеме нет и не будет. С 2026-07-31 один
// человек может руководить несколькими департаментами (как и раньше), И
// один департамент может иметь несколько руководителей (новое) — поэтому
// здесь возвращается полный список, а не только первый (было take: 1).
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
      managedDepartments: { select: { id: true, name: true }, orderBy: { orderIndex: "asc" } },
      projectMemberships: { where: { projectRole: ProjectRole.ГИП }, select: { projectId: true } },
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
    managedDepartments: manager.managedDepartments,
    gipProjectIds: manager.projectMemberships.map((m) => m.projectId),
  }));
}
