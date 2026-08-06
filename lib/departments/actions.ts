"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma, TaskStackCategory } from "@prisma/client";

import { auth } from "@/auth";
import { isPrivilegedOverride, recordAuditLog } from "@/lib/audit/log";
import { sendDepartmentAssignedEmail } from "@/lib/email/send";
import { notifyDepartmentAssigned } from "@/lib/notifications/notify";
import { prisma } from "@/lib/prisma";
import {
  canManageDepartment,
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

// Включает/выключает промежуточную роль "Лид" для департамента (PRD #3
// Phase 3) — только администратор, как и остальная структура компании
// (см. canManageDepartments). Выключение НЕ снимает уже назначенных
// Лидов автоматически — reportsToId у сотрудников остаётся как есть,
// просто UI назначения новых Лидов скрывается, пока не включат обратно.
export async function toggleAllowsLeadRoleAction(departmentId: string, enabled: boolean) {
  const session = await auth();
  if (!session?.user || !canManageDepartments(session.user)) {
    throw new Error("Включать роль Лида может только администратор");
  }

  await prisma.department.update({
    where: { id: departmentId },
    data: { allowsLeadRole: enabled },
  });

  revalidatePath(`/departments/${departmentId}`);
}

// С 2026-07-31 у департамента может быть несколько руководителей
// одновременно (все с одинаковыми правами) — вместо одного "set" теперь
// две отдельные операции add/remove над списком (Department.managers).
//
// 2026-08-06 (по прямой просьбе): раньше это было строго "только
// администратор" ("структурное решение") — теперь ещё и руководитель
// ЭТОГО ЖЕ департамента может добавить себе соруководителя (напр. ГАП в
// Архитектуре), не только глобальный админ/РУКОВОДИТЕЛЬ/ГИП. Список
// кандидатов для не-админа UI ограничивает сотрудниками своего
// департамента (см. app/(dashboard)/departments/[id]/page.tsx) — это
// подсказка в интерфейсе, а не проверка прав, поэтому сервер не
// дублирует такое же ограничение: canManageDepartment ниже пропускает
// любой userId, как и раньше для админа.
export async function addDepartmentManagerAction(departmentId: string, userId: string) {
  const session = await auth();
  const department = await loadDepartmentOrThrow(departmentId);
  if (!session?.user || !canManageDepartment(session.user, department)) {
    throw new Error("Назначать руководителя департамента может только его руководитель или администратор");
  }

  await prisma.$transaction(async (tx) => {
    await tx.department.update({
      where: { id: departmentId },
      data: { managers: { connect: { id: userId } } },
    });

    await recordAuditLog(tx, {
      actorId: session.user.id,
      action: "department_manager_reassign",
      targetType: "Department",
      targetId: departmentId,
      isOverride: isPrivilegedOverride(session.user),
    });
  });

  revalidatePath("/departments");
  revalidatePath(`/departments/${departmentId}`);
  revalidatePath(`/employees/${userId}`);
}

// Симметрично addDepartmentManagerAction выше (2026-08-06) — руководитель
// этого же департамента тоже может снять соруководителя, не только админ.
export async function removeDepartmentManagerAction(departmentId: string, userId: string) {
  const session = await auth();
  const department = await loadDepartmentOrThrow(departmentId);
  if (!session?.user || !canManageDepartment(session.user, department)) {
    throw new Error("Снимать руководителя департамента может только его руководитель или администратор");
  }

  await prisma.$transaction(async (tx) => {
    await tx.department.update({
      where: { id: departmentId },
      data: { managers: { disconnect: { id: userId } } },
    });

    await recordAuditLog(tx, {
      actorId: session.user.id,
      action: "department_manager_reassign",
      targetType: "Department",
      targetId: departmentId,
      isOverride: isPrivilegedOverride(session.user),
    });
  });

  revalidatePath("/departments");
  revalidatePath(`/departments/${departmentId}`);
  revalidatePath(`/employees/${userId}`);
}

// В отличие от назначения руководителя (структурное решение, только
// администратор) — добавлять/убирать рядовых сотрудников своего же
// департамента может и его руководитель (см. план: "полный контроль над
// своим департаментом").
export async function addEmployeeToDepartmentAction(departmentId: string, userId: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }
  const department = await loadDepartmentOrThrow(departmentId);
  if (!canManageDepartment(session.user, department)) {
    throw new Error("Добавлять сотрудников может только руководитель этого департамента или администратор");
  }

  // Руководитель департамента может забрать в свой департамент только
  // ещё никуда не привязанного сотрудника — "переманить" человека из
  // ЧУЖОГО департамента это структурное решение, только администратор
  // (canManageDepartments) может так делать через тот же экшен.
  if (!canManageDepartments(session.user)) {
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { homeDepartmentId: true },
    });
    if (target?.homeDepartmentId && target.homeDepartmentId !== departmentId) {
      throw new Error("Этот сотрудник уже состоит в другом департаменте — переназначить может только администратор");
    }
  }

  const target = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: { homeDepartmentId: departmentId },
    });
    await notifyDepartmentAssigned(tx, {
      userId,
      actorId: session.user.id,
      departmentName: department.name,
    });
    return updated;
  });

  sendDepartmentAssignedEmail({
    to: target.email,
    employeeName: target.fullName,
    departmentName: department.name,
  }).catch((error) => {
    console.error("Не удалось отправить письмо о назначении в департамент", error);
  });

  revalidatePath("/departments");
  revalidatePath(`/departments/${departmentId}`);
  revalidatePath("/employees");
}

// userId, не departmentId: сотрудник может состоять только в одном
// департаменте, поэтому "убрать" однозначно определяется самим сотрудником.
export async function removeEmployeeFromDepartmentAction(userId: string, departmentId: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }
  const department = await loadDepartmentOrThrow(departmentId);
  if (!canManageDepartment(session.user, department)) {
    throw new Error("Убирать сотрудников может только руководитель этого департамента или администратор");
  }

  await prisma.user.update({ where: { id: userId }, data: { homeDepartmentId: null } });

  revalidatePath("/departments");
  revalidatePath(`/departments/${departmentId}`);
  revalidatePath("/employees");
}

// ============================================================
// Базовый стек задач — здесь право на запись уже не только у
// администратора, но и у руководителя ЭТОГО департамента
// (canManageTaskStack), поэтому каждое действие сначала грузит
// департамент и проверяет managers, а не просто systemRole.
// ============================================================

async function loadDepartmentOrThrow(departmentId: string) {
  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { id: true, managers: { select: { id: true } }, name: true },
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
  const categoryRaw = formData.get("category") as string | null;
  const category =
    categoryRaw === TaskStackCategory.НЕСТАНДАРТНЫЙ
      ? TaskStackCategory.НЕСТАНДАРТНЫЙ
      : TaskStackCategory.БАЗОВЫЙ;
  const weight = parseWeight(formData.get("weight"));

  // parentItemId: null — считаем максимум только среди пунктов ВЕРХНЕГО
  // уровня, иначе высокий orderIndex у чьих-то подпунктов сбил бы порядок
  // top-level пунктов (см. createTaskStackSubItemAction — у подпунктов
  // отдельное пространство orderIndex, скоуп по parentItemId). category —
  // у базового и нестандартного стека тоже своё пространство orderIndex,
  // иначе добавление в один список сдвигало бы нумерацию другого.
  const maxOrder = await prisma.departmentTaskTemplateItem.aggregate({
    where: { departmentId, parentItemId: null, category },
    _max: { orderIndex: true },
  });

  await prisma.departmentTaskTemplateItem.create({
    data: {
      departmentId,
      title,
      description,
      category,
      weight,
      orderIndex: (maxOrder._max.orderIndex ?? -1) + 1,
    },
  });

  revalidatePath(`/departments/${departmentId}`);
}

// Вес для весового прогресса раздела (см. Task.weight в схеме) — только у
// пунктов верхнего уровня, минимум 1 (0 или отрицательный вес сделал бы
// пункт невидимым для прогресса, это не то же самое, что "необязательный").
function parseWeight(raw: FormDataEntryValue | null): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.round(parsed));
}

// Подпункт (чек-лист внутри пункта верхнего уровня, напр. "АР Альбом" →
// "Блокировочная схема") — глубина ограничена 2 уровнями: подпункт нельзя
// создать под другим подпунктом (см. план).
export async function createTaskStackSubItemAction(parentItemId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  const parentItem = await prisma.departmentTaskTemplateItem.findUnique({
    where: { id: parentItemId },
    select: {
      departmentId: true,
      parentItemId: true,
      category: true,
      department: { select: { id: true, managers: { select: { id: true } } } },
    },
  });
  if (!parentItem) {
    throw new Error("Пункт базового стека не найден");
  }
  if (parentItem.parentItemId !== null) {
    throw new Error("Нельзя добавить подпункт к подпункту — только 2 уровня вложенности");
  }
  if (!canManageTaskStack(session.user, parentItem.department)) {
    throw new Error("Недостаточно прав для редактирования базового стека задач");
  }

  const title = (formData.get("title") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim() || null;
  if (!title) {
    throw new Error("Название подпункта обязательно");
  }

  const maxOrder = await prisma.departmentTaskTemplateItem.aggregate({
    where: { parentItemId },
    _max: { orderIndex: true },
  });

  // Категория подпункта всегда наследуется от родителя — свой выбор
  // категории пользователю здесь не нужен.
  await prisma.departmentTaskTemplateItem.create({
    data: {
      departmentId: parentItem.departmentId,
      parentItemId,
      title,
      description,
      category: parentItem.category,
      orderIndex: (maxOrder._max.orderIndex ?? -1) + 1,
    },
  });

  revalidatePath(`/departments/${parentItem.departmentId}`);
}

export async function updateTaskStackItemAction(itemId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  const item = await prisma.departmentTaskTemplateItem.findUnique({
    where: { id: itemId },
    select: { departmentId: true, department: { select: { id: true, managers: { select: { id: true } } } } },
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
  // Подпункты (parentItemId не null) вес не редактируют — форма для них не
  // отправляет это поле (см. TaskStackRow), тогда просто оставляем как есть.
  const weightRaw = formData.get("weight");
  const weight = weightRaw !== null ? parseWeight(weightRaw) : undefined;

  await prisma.departmentTaskTemplateItem.update({
    where: { id: itemId },
    data: { title, description, ...(weight !== undefined ? { weight } : {}) },
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
    select: { departmentId: true, department: { select: { id: true, managers: { select: { id: true } } } } },
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

// Копия вставляется сразу после оригинала: сдвигаем orderIndex всех
// последующих пунктов на 1 и вставляем копию на освободившееся место —
// одной транзакцией, чтобы не оставить дыр/дублей при параллельном изменении.
export async function duplicateTaskStackItemAction(itemId: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  const item = await prisma.departmentTaskTemplateItem.findUnique({
    where: { id: itemId },
    select: {
      departmentId: true,
      parentItemId: true,
      title: true,
      description: true,
      category: true,
      orderIndex: true,
      weight: true,
      department: { select: { id: true, managers: { select: { id: true } } } },
      subItems: {
        select: { title: true, description: true },
        orderBy: { orderIndex: "asc" },
      },
    },
  });
  if (!item) {
    throw new Error("Пункт базового стека не найден");
  }
  if (!canManageTaskStack(session.user, item.department)) {
    throw new Error("Недостаточно прав для редактирования базового стека задач");
  }

  await prisma.$transaction(async (tx) => {
    // Скоуп по parentItemId и category, а не только departmentId — иначе
    // дублирование подпункта сдвинуло бы порядок пунктов верхнего уровня
    // (и наоборот), а дублирование в одной категории — порядок другой.
    await tx.departmentTaskTemplateItem.updateMany({
      where: {
        departmentId: item.departmentId,
        parentItemId: item.parentItemId,
        category: item.category,
        orderIndex: { gt: item.orderIndex },
      },
      data: { orderIndex: { increment: 1 } },
    });
    const duplicate = await tx.departmentTaskTemplateItem.create({
      data: {
        departmentId: item.departmentId,
        parentItemId: item.parentItemId,
        title: item.title,
        description: item.description,
        category: item.category,
        weight: item.weight,
        orderIndex: item.orderIndex + 1,
      },
    });

    // Пункт верхнего уровня со своим чек-листом — клонируем и подпункты,
    // иначе "Дублировать" оставляло бы копию без её чек-листа.
    if (item.subItems.length > 0) {
      await tx.departmentTaskTemplateItem.createMany({
        data: item.subItems.map((sub, index) => ({
          departmentId: item.departmentId,
          parentItemId: duplicate.id,
          title: sub.title,
          description: sub.description,
          category: item.category,
          orderIndex: index,
        })),
      });
    }
  });

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
