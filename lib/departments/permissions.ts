import { SystemRole } from "@prisma/client";

// Полное управление департаментами (создание/переименование/удаление,
// смена цвета/иконки, назначение руководителя) — зона ответственности
// администратора компании (РУКОВОДИТЕЛЬ), как и остальная операционка
// (см. lib/projects/permissions.ts::canManageOperations). Отдельной
// системной роли "администратор" не заводим — РУКОВОДИТЕЛЬ уже играет эту
// роль во всей системе.
export function canManageDepartments(user: { systemRole: SystemRole }) {
  return user.systemRole === SystemRole.РУКОВОДИТЕЛЬ;
}

export function isDepartmentManager(
  user: { id: string },
  department: { managerId: string | null },
) {
  return department.managerId === user.id;
}

// Руководитель департамента управляет ТОЛЬКО своим департаментом — это
// производное право, не отдельная системная роль (см. план: Department.
// managerId, а не новое значение SystemRole). Администратор может всё,
// что может руководитель департамента, в любом департаменте.
export function canManageDepartment(
  user: { id: string; systemRole: SystemRole },
  department: { managerId: string | null },
) {
  return canManageDepartments(user) || isDepartmentManager(user, department);
}

// Базовый стек задач — первое место в системе, где не-администратор
// (руководитель департамента) получает реальное право на запись.
export function canManageTaskStack(
  user: { id: string; systemRole: SystemRole },
  department: { managerId: string | null },
) {
  return canManageDepartment(user, department);
}
