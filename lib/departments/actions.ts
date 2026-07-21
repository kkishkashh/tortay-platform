"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  canManageDepartments,
  canManageTaskStack,
} from "@/lib/departments/permissions";
import { DEPARTMENT_ICON_NAMES } from "@/lib/departments/icons";

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

function parseDepartmentFields(formData: FormData) {
  const name = (formData.get("name") as string | null)?.trim();
  const code = (formData.get("code") as string | null)?.trim().toUpperCase();
  const color = (formData.get("color") as string | null)?.trim();
  const icon = (formData.get("icon") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim() || null;

  if (!name || !code) {
    throw new Error("Название и код департамента обязательны");
  }
  if (!color || !HEX_COLOR_PATTERN.test(color)) {
    throw new Error("Некорректный цвет — укажите в формате #RRGGBB");
  }
  if (!icon || !DEPARTMENT_ICON_NAMES.includes(icon)) {
    throw new Error("Выберите иконку из списка");
  }

  return { name, code, color, icon, description };
}

// Создавать/переименовывать/удалять департаменты, менять их цвет/иконку и
// назначать руководителя может только администратор (РУКОВОДИТЕЛЬ) — это
// структура компании, а не рабочий процесс внутри департамента (см.
// lib/departments/permissions.ts::canManageDepartments).
export async function createDepartmentAction(formData: FormData) {
  const session = await auth();
  if (!session?.user || !canManageDepartments(session.user)) {
    throw new Error("Создавать департаменты может только администратор");
  }

  const fields = parseDepartmentFields(formData);

  const maxOrder = await prisma.department.aggregate({ _max: { orderIndex: true } });

  try {
    await prisma.department.create({
      data: { ...fields, orderIndex: (maxOrder._max.orderIndex ?? -1) + 1 },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("Департамент с таким кодом уже существует");
    }
    throw error;
  }

  revalidatePath("/departments");
}

export async function updateDepartmentAction(departmentId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user || !canManageDepartments(session.user)) {
    throw new Error("Редактировать департамент может только администратор");
  }

  const fields = parseDepartmentFields(formData);

  try {
    await prisma.department.update({ where: { id: departmentId }, data: fields });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("Департамент с таким кодом уже существует");
    }
    throw error;
  }

  revalidatePath("/departments");
  revalidatePath(`/departments/${departmentId}`);
}

// Удаление департамента не блокируется наличием сотрудников/разделов —
// вместо этого они отвязываются (departmentId/homeDepartmentId → NULL), а
// пункты базового стека задач удаляются вместе с департаментом (они не
// существуют вне него). Разделы уже созданных проектов остаются как есть,
// просто без департамента ("Без отдела") — история проектов не теряется.
export async function deleteDepartmentAction(departmentId: string) {
  const session = await auth();
  if (!session?.user || !canManageDepartments(session.user)) {
    throw new Error("Удалять департаменты может только администратор");
  }

  await prisma.$transaction(async (tx) => {
    await tx.section.updateMany({ where: { departmentId }, data: { departmentId: null } });
    await tx.user.updateMany({ where: { homeDepartmentId: departmentId }, data: { homeDepartmentId: null } });
    await tx.departmentTaskTemplateItem.deleteMany({ where: { departmentId } });
    await tx.department.delete({ where: { id: departmentId } });
  });

  revalidatePath("/departments");
  redirect("/departments");
}

export async function assignDepartmentManagerAction(
  departmentId: string,
  managerId: string | null,
) {
  const session = await auth();
  if (!session?.user || !canManageDepartments(session.user)) {
    throw new Error("Назначать руководителя департамента может только администратор");
  }

  await prisma.department.update({
    where: { id: departmentId },
    data: { managerId },
  });

  revalidatePath("/departments");
  revalidatePath(`/departments/${departmentId}`);
}

export async function addEmployeeToDepartmentAction(departmentId: string, userId: string) {
  const session = await auth();
  if (!session?.user || !canManageDepartments(session.user)) {
    throw new Error("Добавлять сотрудников в департамент может только администратор");
  }

  await prisma.user.update({ where: { id: userId }, data: { homeDepartmentId: departmentId } });

  revalidatePath("/departments");
  revalidatePath(`/departments/${departmentId}`);
}

// userId, не departmentId: сотрудник может состоять только в одном
// департаменте, поэтому "убрать" однозначно определяется самим сотрудником.
export async function removeEmployeeFromDepartmentAction(userId: string, departmentId: string) {
  const session = await auth();
  if (!session?.user || !canManageDepartments(session.user)) {
    throw new Error("Убирать сотрудников из департамента может только администратор");
  }

  await prisma.user.update({ where: { id: userId }, data: { homeDepartmentId: null } });

  revalidatePath("/departments");
  revalidatePath(`/departments/${departmentId}`);
}

// ============================================================
// Базовый стек задач — здесь право на запись уже не только у
// администратора, но и у руководителя ЭТОГО департамента
// (canManageTaskStack), поэтому каждое действие сначала грузит
// департамент и проверяет managerId, а не просто systemRole.
// ============================================================

async function loadDepartmentOrThrow(departmentId: string) {
  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { id: true, managerId: true },
  });
  if (!department) {
    throw new Error("Департамент не найден");
  }
  return department;
}

export async function createTaskStackItemAction(departmentId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }
  const department = await loadDepartmentOrThrow(departmentId);
  if (!canManageTaskStack(session.user, department)) {
    throw new Error("Недостаточно прав для редактирования базового стека задач");
  }

  const title = (formData.get("title") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim() || null;
  if (!title) {
    throw new Error("Название задачи обязательно");
  }

  const maxOrder = await prisma.departmentTaskTemplateItem.aggregate({
    where: { departmentId },
    _max: { orderIndex: true },
  });

  await prisma.departmentTaskTemplateItem.create({
    data: { departmentId, title, description, orderIndex: (maxOrder._max.orderIndex ?? -1) + 1 },
  });

  revalidatePath(`/departments/${departmentId}`);
}

export async function updateTaskStackItemAction(itemId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  const item = await prisma.departmentTaskTemplateItem.findUnique({
    where: { id: itemId },
    select: { departmentId: true, department: { select: { id: true, managerId: true } } },
  });
  if (!item) {
    throw new Error("Пункт базового стека не найден");
  }
  if (!canManageTaskStack(session.user, item.department)) {
    throw new Error("Недостаточно прав для редактирования базового стека задач");
  }

  const title = (formData.get("title") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim() || null;
  if (!title) {
    throw new Error("Название задачи обязательно");
  }

  await prisma.departmentTaskTemplateItem.update({
    where: { id: itemId },
    data: { title, description },
  });

  revalidatePath(`/departments/${item.departmentId}`);
}

export async function deleteTaskStackItemAction(itemId: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  const item = await prisma.departmentTaskTemplateItem.findUnique({
    where: { id: itemId },
    select: { departmentId: true, department: { select: { id: true, managerId: true } } },
  });
  if (!item) {
    throw new Error("Пункт базового стека не найден");
  }
  if (!canManageTaskStack(session.user, item.department)) {
    throw new Error("Недостаточно прав для редактирования базового стека задач");
  }

  await prisma.departmentTaskTemplateItem.delete({ where: { id: itemId } });

  revalidatePath(`/departments/${item.departmentId}`);
}

// orderedItemIds — полный новый порядок id пунктов этого департамента;
// присваиваем orderIndex по позиции в массиве. Пунктов в стеке всегда
// немного (десятки, не тысячи), поэтому обычный цикл обновлений в одной
// транзакции — простое и достаточно быстрое решение, без отдельной
// батч-библиотеки.
export async function reorderTaskStackItemsAction(
  departmentId: string,
  orderedItemIds: string[],
) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }
  const department = await loadDepartmentOrThrow(departmentId);
  if (!canManageTaskStack(session.user, department)) {
    throw new Error("Недостаточно прав для редактирования базового стека задач");
  }

  await prisma.$transaction(
    orderedItemIds.map((itemId, index) =>
      prisma.departmentTaskTemplateItem.update({
        where: { id: itemId, departmentId },
        data: { orderIndex: index },
      }),
    ),
  );

  revalidatePath(`/departments/${departmentId}`);
}
