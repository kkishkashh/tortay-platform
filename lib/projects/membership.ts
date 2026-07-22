import { Prisma, ProjectRole } from "@prisma/client";

// Общий find-or-create для "человек должен быть участником этого проекта,
// чтобы ему можно было назначить задачу" (мастер создания проекта, шаг 5 —
// см. план, D8). Если запись уже есть — роль НЕ трогаем: назначение задачи
// не должно тихо понижать существующего ГИПа/менеджера до инженера. Роль
// применяется только при реальном создании записи. created=true — сигнал
// для Phase 14, чтобы notifyProjectAssigned срабатывало только на новое
// членство, а не при каждом повторном ensureProjectMember для того же
// человека в рамках одной транзакции.
export async function ensureProjectMember(
  tx: Prisma.TransactionClient,
  { projectId, userId, role }: { projectId: string; userId: string; role: ProjectRole },
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
  return { member, created: true as const };
}
