"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canCommentOnTask, canManageProjectTasks } from "@/lib/tasks/permissions";

async function loadTaskSectionForComments(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      section: {
        select: {
          projectId: true,
          department: { select: { id: true, managers: { select: { id: true } } } },
        },
      },
    },
  });
  if (!task) {
    throw new Error("Задача не найдена");
  }
  return task;
}

export async function createTaskCommentAction(taskId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  const task = await loadTaskSectionForComments(taskId);

  const isProjectMember = Boolean(
    await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: task.section.projectId, userId: session.user.id } },
    }),
  );
  if (!canCommentOnTask(session.user, task.section, isProjectMember)) {
    throw new Error("Недостаточно прав для комментирования этой задачи");
  }

  const text = (formData.get("text") as string | null)?.trim();
  if (!text) {
    throw new Error("Комментарий не может быть пустым");
  }

  await prisma.comment.create({
    data: { taskId, authorId: session.user.id, text },
  });

  revalidatePath(`/projects/${task.section.projectId}`);
}

// Удалить комментарий может либо его автор, либо руководитель (см.
// canManageProjectTasks) — то же деление ролей, что и у самих задач.
export async function deleteTaskCommentAction(commentId: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      authorId: true,
      task: {
        select: {
          section: {
            select: {
              projectId: true,
              department: { select: { id: true, managers: { select: { id: true } } } },
            },
          },
        },
      },
    },
  });
  if (!comment || !comment.task) {
    throw new Error("Комментарий не найден");
  }

  const isAuthor = comment.authorId === session.user.id;
  const isManager = canManageProjectTasks(session.user, comment.task.section);
  if (!isAuthor && !isManager) {
    throw new Error("Недостаточно прав для удаления этого комментария");
  }

  await prisma.comment.delete({ where: { id: commentId } });

  revalidatePath(`/projects/${comment.task.section.projectId}`);
}
