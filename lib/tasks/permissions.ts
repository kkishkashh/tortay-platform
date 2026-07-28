import { SystemRole, TaskStatus } from "@prisma/client";

import { canManageOperations } from "@/lib/projects/permissions";
import { isDepartmentManager } from "@/lib/departments/permissions";

// Управлять задачами раздела (создавать/редактировать/удалять/менять
// приоритет и срок/двигать статус в любую сторону, включая "вернуть на
// доработку") может либо администратор компании, либо руководитель ЛЮБОГО
// департамента (canManageOperations теперь открыта не только админу, см.
// lib/projects/permissions.ts), либо руководитель ТОГО департамента, к
// которому привязан раздел (уже не только через canManageOperations —
// на случай, если сам раздел вообще без департамента, легаси-случай, см.
// миграцию Section.departmentId, D4 в плане).
export function canManageProjectTasks(
  user: { id: string; systemRole: SystemRole },
  section: { department: { managerId: string | null } | null },
  managesAnyDepartment = false,
) {
  if (canManageOperations(user, managesAnyDepartment)) return true;
  if (section.department && isDepartmentManager(user, section.department)) return true;
  return false;
}

// Обычный сотрудник двигает статус СВОЕЙ задачи только вперёд, по одному
// шагу — это единственное действие, доступное исполнителю (см. бриф:
// "Employees cannot edit task details. Employees can ONLY change task
// status"). Проверяется на сервере, а не только скрывается в интерфейсе.
export const FORWARD_TRANSITIONS: Record<TaskStatus, TaskStatus | null> = {
  [TaskStatus.НОВАЯ]: TaskStatus.В_РАБОТЕ,
  [TaskStatus.В_РАБОТЕ]: TaskStatus.НА_ПРОВЕРКЕ,
  [TaskStatus.НА_ПРОВЕРКЕ]: TaskStatus.ВЫПОЛНЕНО,
  [TaskStatus.ВЫПОЛНЕНО]: null,
};

// Комментировать задачу может любой участник ЕЁ проекта (не только
// исполнитель) плюс администратор/руководитель департамента — это
// совместная зона, а не зона контроля, поэтому проверка сильно мягче, чем
// canManageProjectTasks. isProjectMember вычисляется вызывающим кодом
// (запрос к ProjectMember), сюда передаётся уже готовым булевым значением.
export function canCommentOnTask(
  user: { id: string; systemRole: SystemRole },
  section: { department: { managerId: string | null } | null },
  isProjectMember: boolean,
  managesAnyDepartment = false,
) {
  return isProjectMember || canManageProjectTasks(user, section, managesAnyDepartment);
}
