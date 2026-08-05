// Не "use server" — внутренний хелпер, вызывается ТОЛЬКО из других
// server-модулей внутри их же транзакции, аналог lib/activity/log.ts и
// lib/notifications/notify.ts.
import type { Prisma, PrismaClient } from "@prisma/client";
import { SystemRole } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export async function recordAuditLog(
  db: Db,
  data: {
    actorId: string;
    action: string;
    targetType: string;
    targetId: string;
    isOverride?: boolean;
  },
) {
  await db.auditLog.create({
    data: {
      actorId: data.actorId,
      action: data.action,
      targetType: data.targetType,
      targetId: data.targetId,
      isOverride: data.isOverride ?? false,
    },
  });
}

// Действующий пользователь — администратор компании или бухгалтер с
// точечным financeAccess (см. lib/projects/permissions.ts::canManageOperations) —
// то есть в принципе способен вмешаться за пределами своей обычной зоны
// ответственности. Сам по себе не значит "это override" — вызывающий код
// дополнительно сверяет, что цель действия принадлежит/подчиняется
// КОМУ-ТО ДРУГОМУ (см. использование в lib/tasks/actions.ts,
// lib/departments/actions.ts, lib/employees/actions.ts).
export function isPrivilegedOverride(user: { systemRole: SystemRole; financeAccess?: boolean }) {
  return (
    user.systemRole === SystemRole.АДМИН ||
    user.systemRole === SystemRole.РУКОВОДИТЕЛЬ ||
    !!user.financeAccess
  );
}
