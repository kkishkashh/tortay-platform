import { CalendarClock, CheckCircle2, FolderKanban } from "lucide-react";

import { EmployeeProjectCard } from "@/components/dashboard/employee-project-card";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import type { ActivityItem, UpcomingDeadline } from "@/lib/dashboard/queries";
import type { ProjectListItem } from "@/lib/projects/queries";

function greetingForHour(hour: number) {
  if (hour < 5) return "Доброй ночи";
  if (hour < 12) return "Доброе утро";
  if (hour < 18) return "Добрый день";
  return "Добрый вечер";
}

const CHIP_STYLE = {
  blue: "bg-[#2563eb]/10 text-[#1d4fd1] dark:text-[#7ea6ff]",
  gold: "bg-[#e8a030]/15 text-[#a86a10] dark:text-[#f0ac3d]",
  green: "bg-[#16a34a]/10 text-[#0d7a37] dark:text-[#34c76f]",
} as const;

export function EmployeeDashboard({
  fullName,
  activeProjectsCount,
  completedThisYearCount,
  deadlines,
  projects,
  activity,
}: {
  fullName: string;
  activeProjectsCount: number;
  completedThisYearCount: number;
  deadlines: UpcomingDeadline[];
  projects: ProjectListItem[];
  activity: ActivityItem[];
}) {
  const firstName = fullName.split(" ")[0] ?? fullName;
  const greeting = `${greetingForHour(new Date().getHours())}, ${firstName}!`;

  return (
    <div className="space-y-8 p-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{greeting}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${CHIP_STYLE.blue}`}
          >
            <FolderKanban className="size-4" />
            {activeProjectsCount} активных {activeProjectsCount === 1 ? "проект" : "проекта"}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${CHIP_STYLE.gold}`}
          >
            <CalendarClock className="size-4" />
            {deadlines.length} {deadlines.length === 1 ? "дедлайн" : "дедлайна"} на этой неделе
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${CHIP_STYLE.green}`}
          >
            <CheckCircle2 className="size-4" />
            {completedThisYearCount} завершено в {new Date().getFullYear()} году
          </span>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Мои проекты
        </h3>
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Вы пока не состоите ни в одном проекте.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <EmployeeProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>

      <RecentActivity items={activity} />
    </div>
  );
}
