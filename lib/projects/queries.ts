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
