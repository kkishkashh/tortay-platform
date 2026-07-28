import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canCommentOnTask } from "@/lib/tasks/permissions";

// Тот же принцип, что и у app/api/uploads/avatar/route.ts (см. D10 в
// плане): без onUploadCompleted-вебхука, клиент сам вызывает
// createTaskAttachmentAction после успешного upload().
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const session = await auth();
        if (!session?.user) {
          throw new Error("Не авторизован");
        }

        // Клиент формирует путь как `tasks/<taskId>/...` — отсюда же берём
        // taskId для проверки прав, а не доверяем ему без проверки.
        const match = /^tasks\/([^/]+)\//.exec(pathname);
        if (!match) {
          throw new Error("Некорректный путь загрузки");
        }
        const taskId = match[1];

        const task = await prisma.task.findUnique({
          where: { id: taskId },
          select: {
            section: {
              select: {
                projectId: true,
                department: { select: { id: true, managerId: true } },
              },
            },
          },
        });
        if (!task) {
          throw new Error("Задача не найдена");
        }

        const isProjectMember = Boolean(
          await prisma.projectMember.findUnique({
            where: {
              projectId_userId: { projectId: task.section.projectId, userId: session.user.id },
            },
          }),
        );
        if (!canCommentOnTask(session.user, task.section, isProjectMember)) {
          throw new Error("Недостаточно прав для загрузки файлов к этой задаче");
        }

        return {
          allowedContentTypes: [
            "image/png",
            "image/jpeg",
            "image/webp",
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/zip",
            "application/x-zip-compressed",
          ],
          maximumSizeInBytes: 20 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось загрузить файл" },
      { status: 400 },
    );
  }
}
