import { ProjectRole, ProjectStatus, SectionStatus, SystemRole } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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
};

// РУКОВОДИТЕЛЬ видит все проекты компании, СОТРУДНИК — только те,
// где он состоит участником (см. согласованную модель в брифе).
export async function getProjectsForCurrentUser(): Promise<ProjectListItem[]> {
  const session = await auth();
  if (!session?.user) {
    return [];
  }

  const isHead = session.user.systemRole === SystemRole.РУКОВОДИТЕЛЬ;

  const projects = await prisma.project.findMany({
    where: isHead
      ? undefined
      : { members: { some: { userId: session.user.id } } },
    include: {
      members: {
        where: { projectRole: ProjectRole.ГИП },
        include: { user: { select: { fullName: true } } },
        take: 1,
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
      gipName: project.members[0]?.user.fullName ?? null,
      startDate,
      deadline,
      totalSections: project.sections.length,
      completedSections: project.sections.filter(
        (section) => section.status === SectionStatus.ВЫПОЛНЕНО,
      ).length,
      isOverdue:
        project.status === ProjectStatus.В_РАБОТЕ &&
        deadline !== null &&
        deadline < now,
    };
  });
}

// Задачу можно назначить только участнику ЭТОГО проекта (Task.
// assigneeMemberId → ProjectMember, не User напрямую) — см. решение D1 в
// плане: так гарантируется, что исполнитель реально состоит в проекте.
export async function getProjectMembersForTaskAssignment(projectId: string) {
  const members = await prisma.projectMember.findMany({
    where: { projectId },
    select: { id: true, user: { select: { id: true, fullName: true } } },
    orderBy: { user: { fullName: "asc" } },
  });

  return members.map((member) => ({
    id: member.id,
    userId: member.user.id,
    fullName: member.user.fullName,
  }));
}

export type ProjectMemberOption = { id: string; userId: string; fullName: string };

// Пакетная версия getProjectMembersForTaskAssignment — ОДИН запрос на весь
// список проектов вместо запроса на каждый (см. тот же приём в
// lib/comments/queries.ts::getCommentsForTasksBatch).
export async function getProjectMembersForProjects(
  projectIds: string[],
): Promise<Map<string, ProjectMemberOption[]>> {
  const map = new Map<string, ProjectMemberOption[]>();
  if (projectIds.length === 0) return map;

  const members = await prisma.projectMember.findMany({
    where: { projectId: { in: projectIds } },
    select: { id: true, projectId: true, user: { select: { id: true, fullName: true } } },
    orderBy: { user: { fullName: "asc" } },
  });

  for (const member of members) {
    const list = map.get(member.projectId) ?? [];
    list.push({ id: member.id, userId: member.user.id, fullName: member.user.fullName });
    map.set(member.projectId, list);
  }
  return map;
}
