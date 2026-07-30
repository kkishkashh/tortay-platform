import { PulseSignal, SectionStatus } from "@prisma/client";

import { isLeadOfDepartment } from "@/lib/leads/queries";
import { prisma } from "@/lib/prisma";
import { currentIsoWeek } from "@/lib/pulse/week";
import { computeWeightedProgress } from "@/lib/tasks/progress";

export type PulseSectionItem = {
  sectionId: string;
  sectionName: string;
  projectId: string;
  projectName: string;
  departmentId: string;
  departmentName: string;
  departmentColor: string;
  deadline: Date | null;
  pulse: { signal: PulseSignal; note: string | null; authorName: string; createdAt: Date } | null;
  canSetPulse: boolean;
  // Весовой прогресс раздела (см. lib/tasks/progress.ts) — null, если в
  // разделе вообще нет задач.
  progress: number | null;
};

export type PulseDashboard = {
  isoWeek: string;
  sections: PulseSectionItem[];
};

// Департаменты, чей "Пульс недели" видит текущий пользователь — по прямой
// просьбе Камилы (2026-07-30): это ТОЛЬКО реальная принадлежность к
// департаменту (руководит им или состоит в нём как homeDepartment), без
// исключения для админа/бухгалтера — "у тех у кого полная админка тоже не
// нужно, сами если захотят добавят себя в архитектуру". Намеренное
// отступление от canManageOperations (который обычно даёт админу доступ
// везде) — здесь этого делать НЕ нужно.
async function getVisibleDepartmentIds(user: { id: string }): Promise<string[]> {
  const departments = await prisma.department.findMany({
    where: {
      usesPulseTracking: true,
      OR: [{ managerId: user.id }, { employees: { some: { id: user.id } } }],
    },
    select: { id: true },
  });
  return departments.map((d) => d.id);
}

// Лёгкая проверка для пункта меню (Sidebar) — есть ли у пользователя хоть
// один видимый департамент с "Пульс недели", без похода за самими
// разделами.
export async function hasPulseAccess(user: { id: string }): Promise<boolean> {
  const departmentIds = await getVisibleDepartmentIds(user);
  return departmentIds.length > 0;
}

// Дашборд "Пульс недели" (Phase 1 архитектурного дашборда, 2026-07-30) —
// разделы в работе (архивные проекты и выполненные разделы не требуют
// сигнала за эту неделю), сгруппированные по видимым департаментам, вместе
// с уже проставленным на ЭТУ isoWeek сигналом, если он есть. Отсутствие
// сигнала — нейтральное состояние, не ошибка (см. schema.prisma комментарий
// у SectionPulse).
export async function getPulseDashboard(user: { id: string }): Promise<PulseDashboard> {
  const isoWeek = currentIsoWeek();
  const departmentIds = await getVisibleDepartmentIds(user);
  if (departmentIds.length === 0) {
    return { isoWeek, sections: [] };
  }

  const sections = await prisma.section.findMany({
    where: {
      departmentId: { in: departmentIds },
      status: SectionStatus.В_РАБОТЕ,
      project: { isArchived: false },
    },
    select: {
      id: true,
      name: true,
      deadline: true,
      projectId: true,
      project: { select: { name: true } },
      departmentId: true,
      department: { select: { name: true, color: true } },
      pulses: {
        where: { isoWeek },
        select: { signal: true, note: true, createdAt: true, author: { select: { fullName: true } } },
        take: 1,
      },
      tasks: { select: { status: true, weight: true } },
    },
    orderBy: [{ deadline: "asc" }, { name: "asc" }],
  });

  // Кто именно может проставить пульс — руководитель этого департамента,
  // или его Лид (isLeadOfDepartment сам проверяет homeDepartmentId) —
  // считаем один раз на пользователя, не на каждый раздел.
  const managedDepartmentIds = new Set(
    (await prisma.department.findMany({ where: { managerId: user.id }, select: { id: true } })).map((d) => d.id),
  );

  const leadDepartmentIds = new Set<string>();
  for (const departmentId of departmentIds) {
    if (managedDepartmentIds.has(departmentId)) continue;
    if (await isLeadOfDepartment(user.id, departmentId)) {
      leadDepartmentIds.add(departmentId);
    }
  }

  return {
    isoWeek,
    sections: sections
      .filter(
        (section): section is typeof section & { departmentId: string; department: NonNullable<typeof section.department> } =>
          section.departmentId !== null && section.department !== null,
      )
      .map((section) => {
        const pulse = section.pulses[0] ?? null;
        return {
          sectionId: section.id,
          sectionName: section.name,
          projectId: section.projectId,
          projectName: section.project.name,
          departmentId: section.departmentId,
          departmentName: section.department.name,
          departmentColor: section.department.color,
          deadline: section.deadline,
          pulse: pulse
            ? {
                signal: pulse.signal,
                note: pulse.note,
                authorName: pulse.author.fullName,
                createdAt: pulse.createdAt,
              }
            : null,
          canSetPulse:
            managedDepartmentIds.has(section.departmentId) || leadDepartmentIds.has(section.departmentId),
          progress: computeWeightedProgress(section.tasks),
        };
      }),
  };
}
