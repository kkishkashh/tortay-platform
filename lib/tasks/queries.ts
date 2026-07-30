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
  // Весовой прогресс раздела (см. lib/tasks/progress.ts) — копируется из
  // DepartmentTaskTemplateItem.weight при создании, у обычных задач 1.
  weight: number;
  assignee: { id: string; userId: string; fullName: string; avatarUrl: string | null } | null;
  // Кто поставил задачу — null у задач, созданных до Phase 13 (надёжного
  // источника для бэкафилла не было, см. план).
  assignedBy: { id: string; fullName: string } | null;
  // Департамент раздела, которому принадлежит задача — null у "бездепартаментных"
  // разделов (см. Section.departmentId). Рендерится как бейдж только когда есть.
  department: { id: string; name: string; color: string; icon: string } | null;
  // Лёгкий чек-лист внутри задачи (см. план "Task checklist sub-items") —
  // заполняется из подпунктов пункта базового стека при создании проекта.
  checklistItems: { id: string; title: string; isDone: boolean }[];
  commentsCount: number;
  documentsCount: number;
};

export async function getTasksForSection(sectionId: string): Promise<TaskListItem[]> {
  const tasks = await prisma.task.findMany({
    where: { sectionId },
    include: {
      assigneeMember: {
        include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
      },
      assignedByUser: { select: { id: true, fullName: true } },
      section: {
        select: {
          department: { select: { id: true, name: true, color: true, icon: true } },
        },
      },
      checklistItems: { orderBy: { orderIndex: "asc" } },
      _count: { select: { comments: true, documents: true } },
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
    weight: task.weight,
    assignee: task.assigneeMember
      ? {
          id: task.assigneeMember.id,
          userId: task.assigneeMember.user.id,
          fullName: task.assigneeMember.user.fullName,
          avatarUrl: task.assigneeMember.user.avatarUrl,
        }
      : null,
    assignedBy: task.assignedByUser,
    department: task.section.department,
    checklistItems: task.checklistItems.map((c) => ({ id: c.id, title: c.title, isDone: c.isDone })),
    commentsCount: task._count.comments,
    documentsCount: task._count.documents,
  }));
}

// Пакетная версия getTasksForSection — ОДИН запрос на весь список разделов
// проекта вместо запроса на каждый (см. тот же приём в
// lib/comments/queries.ts::getCommentsForTasksBatch). Используется на
// странице проекта, где разделов может быть по одному на департамент.
export async function getTasksForSections(sectionIds: string[]): Promise<Map<string, TaskListItem[]>> {
  const map = new Map<string, TaskListItem[]>();
  if (sectionIds.length === 0) return map;

  const tasks = await prisma.task.findMany({
    where: { sectionId: { in: sectionIds } },
    include: {
      assigneeMember: {
        include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
      },
      assignedByUser: { select: { id: true, fullName: true } },
      section: {
        select: {
          department: { select: { id: true, name: true, color: true, icon: true } },
        },
      },
      checklistItems: { orderBy: { orderIndex: "asc" } },
      _count: { select: { comments: true, documents: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  for (const task of tasks) {
    const item: TaskListItem = {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      deadline: task.deadline,
      createdAt: task.createdAt,
      weight: task.weight,
      assignee: task.assigneeMember
        ? {
            id: task.assigneeMember.id,
            userId: task.assigneeMember.user.id,
            fullName: task.assigneeMember.user.fullName,
            avatarUrl: task.assigneeMember.user.avatarUrl,
          }
        : null,
      assignedBy: task.assignedByUser,
      department: task.section.department,
      checklistItems: task.checklistItems.map((c) => ({ id: c.id, title: c.title, isDone: c.isDone })),
      commentsCount: task._count.comments,
      documentsCount: task._count.documents,
    };
    const list = map.get(task.sectionId) ?? [];
    list.push(item);
    map.set(task.sectionId, list);
  }
  return map;
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
      assigneeMember: {
        include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
      },
      assignedByUser: { select: { id: true, fullName: true } },
      section: {
        include: {
          project: { select: { id: true, name: true } },
          department: { select: { id: true, name: true, color: true, icon: true, managerId: true } },
        },
      },
      checklistItems: { orderBy: { orderIndex: "asc" } },
      _count: { select: { comments: true, documents: true } },
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
    weight: task.weight,
    assignee: task.assigneeMember
      ? {
          id: task.assigneeMember.id,
          userId: task.assigneeMember.user.id,
          fullName: task.assigneeMember.user.fullName,
          avatarUrl: task.assigneeMember.user.avatarUrl,
        }
      : null,
    assignedBy: task.assignedByUser,
    department: task.section.department
      ? {
          id: task.section.department.id,
          name: task.section.department.name,
          color: task.section.department.color,
          icon: task.section.department.icon,
        }
      : null,
    checklistItems: task.checklistItems.map((c) => ({ id: c.id, title: c.title, isDone: c.isDone })),
    commentsCount: task._count.comments,
    documentsCount: task._count.documents,
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
