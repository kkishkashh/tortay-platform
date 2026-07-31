import { ProjectStatus, PulseSignal, SectionStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getVisibleDepartmentIds } from "@/lib/pulse/queries";
import { currentIsoWeek } from "@/lib/pulse/week";
import { workloadLevel, type WorkloadLevel } from "@/lib/workload";

export type TeamWorkloadItem = {
  id: string;
  fullName: string;
  activeProjectsCount: number;
  level: WorkloadLevel;
  // Разбивка пульса ЭТОЙ недели по разделам департамента в активных
  // проектах, где сотрудник состоит участником — НЕ персональная оценка
  // (по прямой просьбе Камилы через прототип ProjecTeam: "только
  // количество активных проектов + разбивка по сигналу здоровья, никаких
  // персональных рейтингов"), а срез состояния работы вокруг человека.
  pulse: { green: number; yellow: number; red: number; none: number };
};

// Команда/загрузка (Phase 4, финальная фаза архитектурного дашборда,
// 2026-07-30) — та же видимость, что у Пульса/Ганта (см.
// getVisibleDepartmentIds): строго члены департамента с
// usesPulseTracking, без обхода для админа.
export async function getTeamWorkload(user: { id: string }): Promise<TeamWorkloadItem[]> {
  const departmentIds = await getVisibleDepartmentIds(user);
  if (departmentIds.length === 0) return [];

  const employees = await prisma.user.findMany({
    where: { homeDepartmentId: { in: departmentIds } },
    select: { id: true, fullName: true, homeDepartment: { select: { code: true } } },
    orderBy: { fullName: "asc" },
  });
  if (employees.length === 0) return [];
  const employeeIds = employees.map((e) => e.id);

  const memberships = await prisma.projectMember.findMany({
    where: { userId: { in: employeeIds }, project: { status: ProjectStatus.В_РАБОТЕ } },
    select: { userId: true, projectId: true },
  });

  const projectIdsByUser = new Map<string, Set<string>>();
  for (const membership of memberships) {
    const set = projectIdsByUser.get(membership.userId) ?? new Set<string>();
    set.add(membership.projectId);
    projectIdsByUser.set(membership.userId, set);
  }

  const allProjectIds = Array.from(new Set(memberships.map((m) => m.projectId)));
  const isoWeek = currentIsoWeek();
  const sections = allProjectIds.length
    ? await prisma.section.findMany({
        where: {
          projectId: { in: allProjectIds },
          departmentId: { in: departmentIds },
          status: SectionStatus.В_РАБОТЕ,
        },
        select: {
          projectId: true,
          pulses: { where: { isoWeek }, select: { signal: true }, take: 1 },
        },
      })
    : [];

  const sectionsByProject = new Map<string, typeof sections>();
  for (const section of sections) {
    const list = sectionsByProject.get(section.projectId) ?? [];
    list.push(section);
    sectionsByProject.set(section.projectId, list);
  }

  return employees
    .map((employee) => {
      const projectIds = projectIdsByUser.get(employee.id) ?? new Set<string>();
      const activeProjectsCount = projectIds.size;
      const pulse = { green: 0, yellow: 0, red: 0, none: 0 };
      for (const projectId of projectIds) {
        for (const section of sectionsByProject.get(projectId) ?? []) {
          const signal = section.pulses[0]?.signal;
          if (signal === PulseSignal.ЗЕЛЁНЫЙ) pulse.green += 1;
          else if (signal === PulseSignal.ЖЁЛТЫЙ) pulse.yellow += 1;
          else if (signal === PulseSignal.КРАСНЫЙ) pulse.red += 1;
          else pulse.none += 1;
        }
      }
      return {
        id: employee.id,
        fullName: employee.fullName,
        activeProjectsCount,
        level: workloadLevel(activeProjectsCount, employee.homeDepartment?.code),
        pulse,
      };
    })
    .sort((a, b) => b.activeProjectsCount - a.activeProjectsCount);
}
