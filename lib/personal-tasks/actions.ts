"use server";

import { revalidatePath } from "next/cache";
import { TaskPriority, TaskStatus } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const TASK_PRIORITY_VALUES = new Set(Object.values(TaskPriority));
// "На проверке" — статус для рабочих задач, которые кто-то проверяет;
// личная задача — только себе, проверять некому, поэтому здесь всего три
// стадии (см. PersonalTaskStatusControl).
const PERSONAL_TASK_STATUS_VALUES = new Set<TaskStatus>([
  TaskStatus.НОВАЯ,
  TaskStatus.В_РАБОТЕ,
  TaskStatus.ВЫПОЛНЕНО,
]);

export async function createPersonalTaskAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  const title = (formData.get("title") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim() || null;
  const priorityRaw = (formData.get("priority") as string | null) ?? TaskPriority.СРЕДНИЙ;
  const deadlineRaw = formData.get("deadline") as string | null;

  if (!title) {
    throw new Error("Название задачи обязательно");
  }
  if (!TASK_PRIORITY_VALUES.has(priorityRaw as TaskPriority)) {
    throw new Error("Некорректный приоритет");
  }

  await prisma.personalTask.create({
    data: {
      userId: session.user.id,
      title,
      description,
      priority: priorityRaw as TaskPriority,
      deadline: deadlineRaw ? new Date(deadlineRaw) : null,
    },
  });

  revalidatePath("/my-tasks");
}

// Личная задача — владелец может двигать статус в любую сторону, никакого
// согласования с руководителем: это не рабочая задача по проекту, а личный
// список дел (см. модель PersonalTask).
export async function updatePersonalTaskStatusAction(taskId: string, nextStatus: TaskStatus) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }
  if (!PERSONAL_TASK_STATUS_VALUES.has(nextStatus)) {
    throw new Error("Некорректный статус");
  }

  const task = await prisma.personalTask.findUnique({ where: { id: taskId } });
  if (!task || task.userId !== session.user.id) {
    throw new Error("Задача не найдена");
  }

  await prisma.personalTask.update({ where: { id: taskId }, data: { status: nextStatus } });

  revalidatePath("/my-tasks");
}

export async function deletePersonalTaskAction(taskId: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  const task = await prisma.personalTask.findUnique({ where: { id: taskId } });
  if (!task || task.userId !== session.user.id) {
    throw new Error("Задача не найдена");
  }

  await prisma.personalTask.delete({ where: { id: taskId } });

  revalidatePath("/my-tasks");
}
