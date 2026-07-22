import { Prisma, ProjectRole } from "@prisma/client";

import { notifyProjectAssigned } from "@/lib/notifications/notify";

// Общий find-or-create для "человек должен быть участником этого проекта,
// чтобы ему можно было назначить задачу" (мастер создания проекта, шаг 5 —
// см. план, D8). Если запись уже есть — роль НЕ трогаем: назначение задачи
// не должно тихо понижать существующего ГИПа/менеджера до инженера. Роль
// применяется только при реальном создании записи. notifyProjectAssigned
// срабатывает только на новое членство (created=true), а не при каждом
// повторном ensureProjectMember для того же человека (см. план, Phase 14).
export async function ensureProjectMember(
  tx: Prisma.TransactionClient,
  {
    projectId,
    userId,
    role,
    actorId,
    projectName,
  }: { projectId: string; userId: string; role: ProjectRole; actorId: string; projectName: string },
) {
  const existing = await tx.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (existing) {
    return { member: existing, created: false as const };
  }

  const member = await tx.projectMember.create({
    data: { projectId, userId, projectRole: role },
  });
  await notifyProjectAssigned(tx, { userId, actorId, projectName });
  return { member, created: true as const };
}
