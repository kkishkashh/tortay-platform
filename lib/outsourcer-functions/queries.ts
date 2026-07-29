import { prisma } from "@/lib/prisma";

export type OutsourcerFunctionItem = {
  id: string;
  name: string;
};

// По возрастанию createdAt — "Лицензия" (посеяна первой) всегда сверху
// списка, новые добавленные функции появляются в конце.
export async function getOutsourcerFunctions(): Promise<OutsourcerFunctionItem[]> {
  return prisma.outsourcerFunction.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
}
