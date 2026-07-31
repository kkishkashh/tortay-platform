"use server";

import { revalidatePath } from "next/cache";
import { del } from "@vercel/blob";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canCommentOnTask, canManageProjectTasks } from "@/lib/tasks/permissions";

async function loadTaskSectionForAttachments(taskId: string) {
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

// Та же аудитория, что и у комментариев (canCommentOnTask) — вложения это
// совместная зона, доступная любому участнику проекта, а не только
// руководителю (см. lib/comments/actions.ts::createTaskCommentAction).
export async function createTaskAttachmentAction(
  taskId: string,
  data: { fileName: string; fileUrl: string; fileSize: number },
) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  const task = await loadTaskSectionForAttachments(taskId);

  const isProjectMember = Boolean(
    await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: task.section.projectId, userId: session.user.id } },
    }),
  );
  if (!canCommentOnTask(session.user, task.section, isProjectMember)) {
    throw new Error("Недостаточно прав для добавления файлов к этой задаче");
  }

  await prisma.document.create({
    data: {
      taskId,
      uploadedBy: session.user.id,
      fileName: data.fileName,
      fileUrl: data.fileUrl,
      fileSize: data.fileSize,
    },
  });

  revalidatePath(`/projects/${task.section.projectId}`);
}

// Удалить вложение может либо тот, кто его загрузил, либо руководитель
// (canManageProjectTasks) — то же деление ролей, что и у комментариев.
export async function deleteTaskAttachmentAction(documentId: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      fileUrl: true,
      uploadedBy: true,
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
  if (!document || !document.task) {
    throw new Error("Файл не найден");
  }

  const isUploader = document.uploadedBy === session.user.id;
  const isManager = canManageProjectTasks(session.user, document.task.section);
  if (!isUploader && !isManager) {
    throw new Error("Недостаточно прав для удаления этого файла");
  }

  await prisma.document.delete({ where: { id: documentId } });

  // Файл в Blob — best-effort, как и у аватара: запись в БД уже удалена,
  // неудачное удаление самого файла не должно ронять экшен.
  del(document.fileUrl).catch((error) => {
    console.error("Не удалось удалить файл из Blob", error);
  });

  revalidatePath(`/projects/${document.task.section.projectId}`);
}
