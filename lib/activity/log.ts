import type { Prisma, PrismaClient } from "@prisma/client";

// Принимает либо prisma, либо tx (Prisma.TransactionClient) — события
// проекта/раздела пишутся в той же транзакции, что и само изменение,
// чтобы запись в ленте не могла "отвалиться" от реального события.
export async function logActivity(
  db: PrismaClient | Prisma.TransactionClient,
  data: { projectId: string; actorId: string; message: string },
) {
  await db.activityLog.create({ data });
}
