import { ProjectRole, ProjectStatus, SectionStatus, ShiftReasonCategory, SystemRole } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageFinance, canManageOperations } from "@/lib/projects/permissions";
import { isFullAdmin } from "@/lib/auth/roles";

export type ProjectListItem = {
  id: string;
  name: string;
  status: ProjectStatus;
  gipName: string | null;
  startDate: Date | null;
  deadline: Date | null;
  totalSections: number;
  completedSections: number;
  // "Задержан" — не отдельный статус в БД (см. обсуждение), а вычисляется
  // на лету: проект в работе, но самый поздний срок раздела уже прошёл.
  isOverdue: boolean;
  // "Создан просроченным" (2026-08-06) — в отличие от isOverdue выше, это
  // не текущее состояние, а зафиксированный при создании факт (см.
  // Project.overdueReason/finalDeadline, createProjectAction). Разные
  // вещи: проект может перестать быть isOverdue после переноса сроков
  // разделов, но wasCreatedOverdue остаётся историческим фактом навсегда.
  wasCreatedOverdue: boolean;
  // Task 1.2 (PRD #3 Phase 2) — архивные проекты остаются в этом списке
  // (не фильтруются в запросе), UI по умолчанию их прячет (см.
  // projects-explorer.tsx), тот же паттерн, что у getEmployees/isActive.
  isArchived: boolean;
};

// РУКОВОДИТЕЛЬ видит все проекты компании, СОТРУДНИК — только те,
// где он состоит участником (см. согласованную модель в брифе). Отдельно —
// доступ к финансам (canManageFinance: ADM-руководитель, бухгалтеры с
// financeAccess) тоже видит все проекты, но только чтобы найти проект и
// привязать к нему аутсорсера — самими проектами эти люди не управляют
// (см. lib/project-outsourcers).
export async function getProjectsForCurrentUser(): Promise<ProjectListItem[]> {
  const session = await auth();
  if (!session?.user) {
    return [];
  }

  // Видит ВСЕ проекты компании — строго АДМИН (company-wide, как и
  // company-wide дашборд, см. lib/departments/queries.ts::getCurrentUserRoleTier),
  // тот, у кого есть доступ к финансам (canManageFinance — им нужно видеть
  // все проекты, чтобы найти нужный и привязать аутсорсера), либо точечный
  // флаг allProjectsAccess (2026-08-06, для руководителя Архитектуры —
  // см. lib/projects/permissions.ts::canManageOperations).
  const isHead = isFullAdmin(session.user.systemRole);
  const seesAll =
    isHead || !!session.user.allProjectsAccess || (await canManageFinance(session.user));

  const projects = await prisma.project.findMany({
    where: seesAll
      ? undefined
      : { members: { some: { userId: session.user.id } } },
    include: {
      // Может быть несколько ГИП на одном проекте (2026-08-06, по прямой
      // просьбе) — раньше здесь стоял take: 1, показывавший только первого.
      members: {
        where: { projectRole: ProjectRole.ГИП },
        include: { user: { select: { fullName: true } } },
      },
      sections: { select: { status: true, startDate: true, deadline: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();

  return projects.map((project) => {
    const starts = project.sections
      .map((section) => section.startDate)
      .filter((date): date is Date => date !== null);
    const deadlines = project.sections
      .map((section) => section.deadline)
      .filter((date): date is Date => date !== null);

    const startDate = starts.length
      ? new Date(Math.min(...starts.map((date) => date.getTime())))
      : null;
    const deadline = deadlines.length
      ? new Date(Math.max(...deadlines.map((date) => date.getTime())))
      : null;

    return {
      id: project.id,
      name: project.name,
      status: project.status,
      gipName:
        project.members.length > 0
          ? project.members.map((member) => member.user.fullName).join(", ")
          : null,
      startDate,
      deadline,
      totalSections: project.sections.length,
      completedSections: project.sections.filter(
        (section) => section.status === SectionStatus.ВЫПОЛНЕНО,
      ).length,
      wasCreatedOverdue: project.overdueReason !== null,
      isOverdue:
        project.status === ProjectStatus.В_РАБОТЕ &&
        deadline !== null &&
        deadline < now,
      isArchived: project.isArchived,
    };
  });
}

export type UserProjectItem = { id: string; name: string; status: ProjectStatus };

// Проекты, прикреплённые к конкретным людям (2026-08-06, для блоков
// Руководителя/Ведущего архитектора на вкладке «Структура» департамента —
// см. app/(dashboard)/departments/[id]/teams/[managerId]/team-detail-view.tsx) —
// один пакетный запрос на весь список сразу, а не по человеку. "Прикреплён"
// = обычное членство ProjectMember (та же связь, что и "Добавить участника"
// на странице проекта), без нового поля в схеме.
export async function getProjectsForUsers(userIds: string[]): Promise<Map<string, UserProjectItem[]>> {
  const map = new Map<string, UserProjectItem[]>();
  if (userIds.length === 0) return map;

  const memberships = await prisma.projectMember.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, project: { select: { id: true, name: true, status: true } } },
    orderBy: { project: { createdAt: "desc" } },
  });

  for (const membership of memberships) {
    const list = map.get(membership.userId) ?? [];
    list.push(membership.project);
    map.set(membership.userId, list);
  }
  return map;
}

export type SectionDeadlineChangeItem = {
  id: string;
  previousDeadline: Date | null;
  newDeadline: Date | null;
  reasonCategory: ShiftReasonCategory | null;
  comment: string | null;
  changedByName: string;
  createdAt: Date;
};

// История изменений срока раздела (по просьбе Камилы) — новые сверху,
// для маленькой попап-истории у SectionDatesFields.
export async function getSectionDeadlineHistory(sectionId: string): Promise<SectionDeadlineChangeItem[]> {
  const changes = await prisma.sectionDeadlineChange.findMany({
    where: { sectionId },
    select: {
      id: true,
      previousDeadline: true,
      newDeadline: true,
      reasonCategory: true,
      comment: true,
      createdAt: true,
      changedByUser: { select: { fullName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return changes.map((change) => ({
    id: change.id,
    previousDeadline: change.previousDeadline,
    newDeadline: change.newDeadline,
    reasonCategory: change.reasonCategory,
    comment: change.comment,
    changedByName: change.changedByUser.fullName,
    createdAt: change.createdAt,
  }));
}

export type ManageableProjectOption = {
  id: string;
  name: string;
  sections: { id: string; name: string }[];
};

// По прямой просьбе Камилы (2026-07-30): с профиля сотрудника — быстро
// выбрать существующий проект/раздел и создать задачу прямо на него (см.
// lib/tasks/actions.ts::createTaskForEmployeeAction). Список — только те
// проекты/разделы, где у пользователя ЕСТЬ право создавать задачи
// (canManageProjectTasks — та же проверка, что и на самой странице
// проекта): админ/бухгалтер видят все разделы, руководитель департамента —
// только разделы СВОЕГО департамента. Проекты без ни одного подходящего
// раздела не попадают в список вовсе.
// Простой список проектов "какие может назначить ГИПом" — для пикера на
// странице сотрудника (Кадровые данные), см. assign-gip-from-employee.tsx.
// Та же область видимости, что и у диалога на самой странице проекта
// (canManageOperations): админ/руководитель/ГИП/бухгалтер — видят все
// проекты; руководитель департамента — только те, где у него есть свой
// раздел.
export async function getProjectsForGipPicker(user: {
  id: string;
  systemRole: SystemRole;
  financeAccess?: boolean;
  isProjectLead?: boolean;
}): Promise<{ id: string; name: string }[]> {
  const seesAll = canManageOperations(user);
  return prisma.project.findMany({
    where: seesAll
      ? undefined
      : { sections: { some: { department: { managers: { some: { id: user.id } } } } } },
    select: { id: true, name: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getManageableProjectsForTaskCreation(user: {
  id: string;
  systemRole: SystemRole;
}): Promise<ManageableProjectOption[]> {
  const seesAll = canManageOperations(user);

  const projects = await prisma.project.findMany({
    where: seesAll
      ? undefined
      : { sections: { some: { department: { managers: { some: { id: user.id } } } } } },
    select: {
      id: true,
      name: true,
      sections: {
        select: { id: true, name: true, department: { select: { managers: { select: { id: true } } } } },
        orderBy: { orderIndex: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return projects
    .map((project) => ({
      id: project.id,
      name: project.name,
      sections: (seesAll
        ? project.sections
        : project.sections.filter((s) => s.department?.managers.some((m) => m.id === user.id))
      ).map((s) => ({ id: s.id, name: s.name })),
    }))
    .filter((project) => project.sections.length > 0);
}
