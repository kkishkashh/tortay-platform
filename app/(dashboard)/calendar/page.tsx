import { PageHeader } from "@/components/layout/page-header";
import { DeadlineCalendar } from "@/components/calendar/deadline-calendar";
import { getMyTasks } from "@/lib/tasks/queries";
import { getMyPersonalTasks } from "@/lib/personal-tasks/queries";
import type { CalendarDeadlineItem } from "@/lib/calendar/types";
import { formatTodayLabel } from "@/lib/utils";

export default async function CalendarPage() {
  const [tasks, personalTasks] = await Promise.all([getMyTasks(), getMyPersonalTasks()]);

  // Личные задачи (см. "+ Новая задача" на /my-tasks) не привязаны ни к
  // какому проекту, но у них тоже есть срок и приоритет — раньше они
  // молча пропадали с календаря, потому что здесь читались только задачи
  // из проектов (getMyTasks).
  const deadlineItems: CalendarDeadlineItem[] = [
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

  return (
    <>
      <PageHeader title="Календарь" subtitle={formatTodayLabel(new Date())} />
      <div className="p-8">
        <DeadlineCalendar items={deadlineItems} />
      </div>
    </>
  );
}
