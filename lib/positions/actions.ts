"use server";

import { revalidatePath } from "next/cache";
import { Prisma, SystemRole } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Тот же круг, кто может создавать/редактировать сотрудников (см.
// createEmployeeAction в lib/employees/actions.ts) — должность добавляется
// прямо из той же формы, так что права те же: администратор — без
// ограничений, руководитель департамента — тоже может, так как сам
// заполняет это поле при найме в свой департамент.
async function assertCanManagePositions() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }
  if (
    session.user.systemRole === SystemRole.АДМИН ||
    session.user.systemRole === SystemRole.РУКОВОДИТЕЛЬ
  ) {
    return;
  }
  const managed = await prisma.department.findFirst({
    where: { managers: { some: { id: session.user.id } } },
  });
  if (!managed) {
    throw new Error("Недостаточно прав");
  }
}

export async function createPositionAction(name: string) {
  await assertCanManagePositions();

  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Название должности не может быть пустым");
  }

  try {
    const position = await prisma.position.create({ data: { name: trimmed } });
    revalidatePath("/employees");
    return position;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // Гонка или просто уже кто-то добавил ту же должность раньше —
      // не ошибка с точки зрения пользователя, просто отдаём существующую.
      const existing = await prisma.position.findUnique({ where: { name: trimmed } });
      if (existing) return existing;
    }
    throw error;
  }
}
