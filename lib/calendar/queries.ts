import { getMyTasks } from "@/lib/tasks/queries";
import { getMyPersonalTasks } from "@/lib/personal-tasks/queries";
import type { CalendarDeadlineItem } from "@/lib/calendar/types";

// Личный календарь по своим задачам (проектным + личным) — используется и
// глобальной страницей /calendar, и видом "Календарь" внутри объединённой
// вкладки "Гант" (2026-08-07, см. app/(dashboard)/gantt/page.tsx), чтобы не
// дублировать сборку списка в двух местах.
export async function getMyCalendarDeadlineItems(): Promise<CalendarDeadlineItem[]> {
  const [tasks, personalTasks] = await Promise.all([getMyTasks(), getMyPersonalTasks()]);

  return [
    ...tasks
      .filter((t) => t.deadline !== null)
      .map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        deadline: t.deadline!,
        subtitle: t.projectName,
        href: `/projects/${t.projectId}`,
      })),
    ...personalTasks
      .filter((t) => t.deadline !== null)
      .map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        deadline: t.deadline!,
        subtitle: "Личная задача",
        href: "/my-tasks",
      })),
  ];
}
