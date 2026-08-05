import { SystemRole } from "@prisma/client";

// Полное управление департаментами (создание/переименование/удаление,
// смена цвета/иконки, назначение руководителя) — зона ответственности
// АДМИН и РУКОВОДИТЕЛЬ (см. schema.prisma — с 2026-08-05 это две отдельные
// системные роли, обе получают операционные права, см. lib/projects/
// permissions.ts::canManageOperations; разница между ними — в финансах и
// company-wide дашборде, не здесь). ГИП хотя бы одного проекта (isGip) —
// та же операционная зона, что и РУКОВОДИТЕЛЬ (см. canManageOperations).
export function canManageDepartments(user: { systemRole: SystemRole; isGip?: boolean }) {
  return (
    user.systemRole === SystemRole.АДМИН ||
    user.systemRole === SystemRole.РУКОВОДИТЕЛЬ ||
    !!user.isGip
  );
}

// С 2026-07-31 у департамента может быть несколько руководителей
// одновременно (Department.managers, многие-ко-многим) — все с одинаковыми
// правами, поэтому проверка — членство в списке, а не равенство одному id.
export function isDepartmentManager(
  user: { id: string },
  department: { managers: { id: string }[] },
) {
  return department.managers.some((manager) => manager.id === user.id);
}

// Руководитель департамента управляет ТОЛЬКО своим департаментом — это
// производное право, не отдельная системная роль (см. план: Department.
// managers, а не новое значение SystemRole). Администратор может всё,
// что может руководитель департамента, в любом департаменте.
export function canManageDepartment(
  user: { id: string; systemRole: SystemRole; isGip?: boolean },
  department: { managers: { id: string }[] },
) {
  return canManageDepartments(user) || isDepartmentManager(user, department);
}

// Базовый стек задач — первое место в системе, где не-администратор
// (руководитель департамента) получает реальное право на запись.
export function canManageTaskStack(
  user: { id: string; systemRole: SystemRole; isGip?: boolean },
  department: { managers: { id: string }[] },
) {
  return canManageDepartment(user, department);
}
