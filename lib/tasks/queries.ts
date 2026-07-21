import { TaskPriority, TaskStatus } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type TaskListItem = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  deadline: Date | null;
  createdAt: Date;
  assignee: { id: string; userId: string; fullName: string } | null;
  commentsCount: number;
};

export async function getTasksForSection(sectionId: string): Promise<TaskListItem[]> {
  const tasks = await prisma.task.findMany({
    where: { sectionId },
    include: {
      assigneeMember: { include: { user: { select: { id: true, fullName: true } } } },
      _count: { select: { comments: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    deadline: task.deadline,
    createdAt: task.createdAt,
    assignee: task.assigneeMember
      ? {
          id: task.assigneeMember.id,
          userId: task.assigneeMember.user.id,
          fullName: task.assigneeMember.user.fullName,
        }
      : null,
    commentsCount: task._count.comments,
  }));
}

export type MyTaskItem = TaskListItem & {
  projectId: string;
  projectName: string;
  sectionId: string;
  sectionName: string;
  // Для проверки canManageProjectTasks на странице профиля сотрудника
  // (там задачи могут быть из разных проектов/департаментов, поэтому
  // права считаются по каждой задаче отдельно).
  departmentManagerId: string | null;
};

// Задачи, назначенные КОНКРЕТНОМУ пользователю — не обязательно текущему.
// Используется и для "Мои задачи" (getMyTasks ниже — текущий пользователь),
// и для вкладки "Проекты и задачи" в профиле сотрудника (см.
// employees/[id]/page.tsx — там userId чужой).
export async function getTasksForUser(userId: string): Promise<MyTaskItem[]> {
  const tasks = await prisma.task.findMany({
    where: { assigneeMember: { userId } },
    include: {
      assigneeMember: { include: { user: { select: { id: true, fullName: true } } } },
      section: {
        include: {
          project: { select: { id: true, name: true } },
          department: { select: { managerId: true } },
        },
      },
      _count: { select: { comments: true } },
    },
    orderBy: [{ deadline: "asc" }, { createdAt: "asc" }],
  });

  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    deadline: task.deadline,
    createdAt: task.createdAt,
    assignee: task.assigneeMember
      ? {
          id: task.assigneeMember.id,
          userId: task.assigneeMember.user.id,
          fullName: task.assigneeMember.user.fullName,
        }
      : null,
    commentsCount: task._count.comments,
    projectId: task.section.project.id,
    projectName: task.section.project.name,
    sectionId: task.section.id,
    sectionName: task.section.name,
    departmentManagerId: task.section.department?.managerId ?? null,
  }));
}

// Задачи, назначенные текущему пользователю — источник для "Мои задачи"
// на упрощённом дашборде сотрудника.
export async function getMyTasks(): Promise<MyTaskItem[]> {
  const session = await auth();
  if (!session?.user) return [];
  return getTasksForUser(session.user.id);
}
