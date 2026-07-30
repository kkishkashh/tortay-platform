import { prisma } from "@/lib/prisma";

export type AuditLogEntry = {
  id: string;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string;
  isOverride: boolean;
  createdAt: Date;
};

// Только для /audit-log (admin-only, см. lib/departments/permissions.ts::
// canManageDepartments в самой странице) — простой хвост последних записей,
// без пагинации: объём страницы пока небольшой, добавим при необходимости.
export async function getAuditLog(limit = 200): Promise<AuditLogEntry[]> {
  const entries = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { actor: { select: { fullName: true } } },
  });

  return entries.map((entry) => ({
    id: entry.id,
    actorName: entry.actor.fullName,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    isOverride: entry.isOverride,
    createdAt: entry.createdAt,
  }));
}
