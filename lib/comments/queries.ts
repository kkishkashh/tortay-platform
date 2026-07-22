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

// Пакетная версия getCommentsForTask — ОДИН запрос на весь список задач
// вместо запроса на каждую (та же логика для getDocumentsForTasksBatch,
// см. lib/documents/queries.ts). Страницы со списком задач (проект,
// профиль сотрудника, "Мои задачи") раньше делали по 2 запроса НА КАЖДУЮ
// задачу (комментарии + документы) внутри Promise.all(tasks.map(...)) —
// при десятках задач это десятки последовательных round-trip'ов к Neon,
// и именно это было причиной долгой загрузки этих страниц.
export async function getCommentsForTasksBatch(
  taskIds: string[],
): Promise<Map<string, TaskCommentItem[]>> {
  const map = new Map<string, TaskCommentItem[]>();
  if (taskIds.length === 0) return map;

  const comments = await prisma.comment.findMany({
    where: { taskId: { in: taskIds } },
    include: { author: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: "asc" },
  });

  for (const c of comments) {
    if (!c.taskId) continue;
    const list = map.get(c.taskId) ?? [];
    list.push({ id: c.id, text: c.text, createdAt: c.createdAt, author: c.author });
    map.set(c.taskId, list);
  }
  return map;
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
