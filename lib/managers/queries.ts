import { ProjectRole, SystemRole } from "@prisma/client";

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

export type ChiefTechnicalDirectorItem = {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  isActive: boolean;
};

// ГЛАВНЫЙ_ТЕХНИЧЕСКИЙ_ДИРЕКТОР (2026-08-06) — отдельный блок над обычной
// таблицей руководителей на /managers (см. ManagersTab), т.к. это системная
// роль с правами уровня АДМИН (см. lib/auth/roles.ts::isFullAdmin), а не
// производный статус "руководит департаментом", как у обычных руководителей
// в getManagers() выше — человек с этой ролью может вообще не значиться
// руководителем ни одного департамента и всё равно управлять компанией
// целиком.
export async function getChiefTechnicalDirectors(): Promise<ChiefTechnicalDirectorItem[]> {
  const users = await prisma.user.findMany({
    where: { systemRole: SystemRole.ГЛАВНЫЙ_ТЕХНИЧЕСКИЙ_ДИРЕКТОР },
    select: { id: true, fullName: true, email: true, avatarUrl: true, isActive: true },
    orderBy: { fullName: "asc" },
  });
  return users;
}
