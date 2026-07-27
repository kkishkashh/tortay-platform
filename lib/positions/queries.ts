import { prisma } from "@/lib/prisma";

export type PositionItem = {
  id: string;
  name: string;
};

// По возрастанию createdAt — сохраняет исходный порядок из бывшего
// захардкоженного COMMON_POSITIONS (см. prisma/scripts/seed-positions.ts),
// новые добавленные должности появляются в конце списка.
export async function getPositions(): Promise<PositionItem[]> {
  return prisma.position.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
}
