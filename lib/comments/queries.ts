import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type TaskCommentItem = {
  id: string;
  text: string;
  createdAt: Date;
  author: { id: string; fullName: string };
};

export async function getCommentsForTask(taskId: string): Promise<TaskCommentItem[]> {
  const comments = await prisma.comment.findMany({
    where: { taskId },
    include: { author: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: "asc" },
  });

  return comments.map((c) => ({
    id: c.id,
    text: c.text,
    createdAt: c.createdAt,
    author: c.author,
  }));
}

export type AssigneeCommentItem = TaskCommentItem & {
  taskId: string;
  taskTitle: string;
  projectId: string;
  projectName: string;
};

// Комментарии ко ВСЕМ задачам, назначенным конкретному сотруднику —
// источник для вкладки "Комментарии" в профиле сотрудника (см. финальные
// фазы плана). Строится сейчас, чтобы там просто вызвать готовую функцию.
// Лёгкий count (не полные объекты) для подписи "N новых комментариев за
// неделю" под приветствием на дашборде сотрудника (см. план, Phase 16, D14) —
// та же выборка задач, что и getCommentsForAssignee, но без загрузки текста.
export async function getWeeklyCommentsCountForAssignee(userId: string): Promise<number> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return prisma.comment.count({
    where: { task: { assigneeMember: { userId } }, createdAt: { gte: weekAgo } },
  });
}

export async function getCommentsForAssignee(userId: string): Promise<AssigneeCommentItem[]> {
  const session = await auth();
  if (!session?.user) return [];

  const comments = await prisma.comment.findMany({
    where: { task: { assigneeMember: { userId } } },
    include: {
      author: { select: { id: true, fullName: true } },
      task: { select: { id: true, title: true, section: { select: { project: { select: { id: true, name: true } } } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return comments
    .filter((c) => c.task !== null)
    .map((c) => ({
      id: c.id,
      text: c.text,
      createdAt: c.createdAt,
      author: c.author,
      taskId: c.task!.id,
      taskTitle: c.task!.title,
      projectId: c.task!.section.project.id,
      projectName: c.task!.section.project.name,
    }));
}
