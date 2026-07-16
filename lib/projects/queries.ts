import { SystemRole } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// РУКОВОДИТЕЛЬ видит все проекты компании, СОТРУДНИК — только те,
// где он состоит участником (см. согласованную модель в брифе).
export async function getProjectsForCurrentUser() {
  const session = await auth();
  if (!session?.user) {
    return [];
  }

  const isHead = session.user.systemRole === SystemRole.РУКОВОДИТЕЛЬ;

  return prisma.project.findMany({
    where: isHead
      ? undefined
      : { members: { some: { userId: session.user.id } } },
    include: { _count: { select: { members: true } } },
    orderBy: { createdAt: "desc" },
  });
}
