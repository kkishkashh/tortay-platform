"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageFinance } from "@/lib/projects/permissions";

// Тот же круг, кто вообще работает с аутсорсерами (см. canManageFinance) —
// функция добавляется прямо из формы аутсорсера, так что права те же.
export async function createOutsourcerFunctionAction(name: string) {
  const session = await auth();
  if (!session?.user || !(await canManageFinance(session.user))) {
    throw new Error("Недостаточно прав");
  }

  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Название функции не может быть пустым");
  }

  try {
    const created = await prisma.outsourcerFunction.create({ data: { name: trimmed } });
    revalidatePath("/outsourcers");
    return created;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.outsourcerFunction.findUnique({ where: { name: trimmed } });
      if (existing) return existing;
    }
    throw error;
  }
}
