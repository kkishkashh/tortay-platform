import { prisma } from "@/lib/prisma";
import { getVisibleDepartmentIds } from "@/lib/pulse/queries";

export type GanttSectionItem = {
  sectionId: string;
  sectionName: string;
  status: "В_РАБОТЕ" | "ВЫПОЛНЕНО";
  startDate: Date | null;
  deadline: Date | null;
  baselineStartDate: Date | null;
  baselineDeadline: Date | null;
};

export type GanttProjectGroup = {
  projectId: string;
  projectName: string;
  departmentColor: string;
  sections: GanttSectionItem[];
};

export type GanttData = {
  projects: GanttProjectGroup[];
  // Общий диапазон дат по всем видимым разделам — для единой временной шкалы.
  rangeStart: Date | null;
  rangeEnd: Date | null;
};

// Гант с базовым/текущим сроком (Phase 3 архитектурного дашборда,
// 2026-07-30) — та же видимость, что у "Пульс недели" (см.
// lib/pulse/queries.ts::getVisibleDepartmentIds): строго члены
// департамента с usesPulseTracking, без обхода для админа. Показываются
// ВСЕ разделы этого департамента (не только "в работе") — Гант это обзор
// всего таймлайна проекта, а не еженедельная проверка.
export async function getGanttData(user: { id: string }): Promise<GanttData> {
  const departmentIds = await getVisibleDepartmentIds(user);
  if (departmentIds.length === 0) {
    return { projects: [], rangeStart: null, rangeEnd: null };
  }

  const sections = await prisma.section.findMany({
    where: {
      departmentId: { in: departmentIds },
      project: { isArchived: false },
    },
    select: {
      id: true,
      name: true,
      status: true,
      startDate: true,
      deadline: true,
      baselineStartDate: true,
      baselineDeadline: true,
      projectId: true,
      project: { select: { name: true, createdAt: true } },
      department: { select: { color: true } },
    },
    orderBy: [{ project: { createdAt: "desc" } }, { orderIndex: "asc" }],
  });

  const groups = new Map<string, GanttProjectGroup>();
  for (const section of sections) {
    const group = groups.get(section.projectId) ?? {
      projectId: section.projectId,
      projectName: section.project.name,
      departmentColor: section.department?.color ?? "#94a3b8",
      sections: [],
    };
    group.sections.push({
      sectionId: section.id,
      sectionName: section.name,
      status: section.status,
      startDate: section.startDate,
      deadline: section.deadline,
      baselineStartDate: section.baselineStartDate,
      baselineDeadline: section.baselineDeadline,
    });
    groups.set(section.projectId, group);
  }

  const allDates = sections
    .flatMap((s) => [s.startDate, s.deadline, s.baselineStartDate, s.baselineDeadline])
    .filter((d): d is Date => d !== null);
  const rangeStart = allDates.length ? new Date(Math.min(...allDates.map((d) => d.getTime()))) : null;
  const rangeEnd = allDates.length ? new Date(Math.max(...allDates.map((d) => d.getTime()))) : null;

  return {
    projects: Array.from(groups.values()),
    rangeStart,
    rangeEnd,
  };
}
