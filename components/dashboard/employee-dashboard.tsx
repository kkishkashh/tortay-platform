import Link from "next/link";
import {
  Bell,
  Calendar,
  CheckCircle2,
  FolderKanban,
  ListTodo,
  MessageSquare,
  User,
} from "lucide-react";

import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import { getFirstName } from "@/lib/utils";

function greetingForHour(hour: number) {
  if (hour < 5) return "Доброй ночи";
  if (hour < 12) return "Доброе утро";
  if (hour < 18) return "Добрый день";
  return "Добрый вечер";
}

type Tile = {
  href: string;
  label: string;
  icon: typeof FolderKanban;
  badge?: number;
  gradient: string;
  // Только у плитки "Мои задачи" — доля выполненных среди всех назначенных
  // (см. план, Phase 16, D14). undefined, если задач ещё нет вовсе.
  completionPercent?: number;
};

// Ровно 5 плиток по брифу: My Projects / My Tasks / Notifications /
// Calendar / Profile — никакой финансовой или административной
// информации сотруднику здесь не показываем (см. бриф, "Employee
// Dashboard"). Прогресс-бар на "Мои задачи" и подпись про комментарии —
// единственные добавления Phase 16, число плиток не меняется.
export function EmployeeDashboard({
  fullName,
  employeeId,
  activeProjectsCount,
  activeTasksCount,
  totalTasksCount,
  unreadNotificationCount,
  completedThisYearCount,
  weeklyCommentsCount,
}: {
  fullName: string;
  employeeId: string;
  activeProjectsCount: number;
  activeTasksCount: number;
  totalTasksCount: number;
  unreadNotificationCount: number;
  completedThisYearCount: number;
  weeklyCommentsCount: number;
}) {
  const firstName = getFirstName(fullName);
  const greeting = `${greetingForHour(new Date().getHours())}, ${firstName}!`;
  const completedTasksCount = totalTasksCount - activeTasksCount;
  const taskCompletionPercent =
    totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : undefined;

  const tiles: Tile[] = [
    {
      href: "/projects",
      label: "Мои проекты",
      icon: FolderKanban,
      badge: activeProjectsCount,
      gradient: "from-[#2563eb] to-[#1741a6]",
    },
    {
      href: "/my-tasks",
      label: "Мои задачи",
      icon: ListTodo,
      badge: activeTasksCount,
      gradient: "from-[#f0ac3d] to-[#c47a12]",
      completionPercent: taskCompletionPercent,
    },
    {
      href: "/notifications",
      label: "Уведомления",
      icon: Bell,
      badge: unreadNotificationCount,
      gradient: "from-[#e34948] to-[#a82c2b]",
    },
    {
      href: "/calendar",
      label: "Календарь",
      icon: Calendar,
      gradient: "from-[#7c3aed] to-[#5423ab]",
    },
    {
      href: `/employees/${employeeId}`,
      label: "Профиль",
      icon: User,
      gradient: "from-[#16a34a] to-[#0d7a37]",
    },
  ];

  return (
    <div className="space-y-8 p-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{greeting}</h2>
        {completedThisYearCount > 0 ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4" />
            {completedThisYearCount} завершено в {new Date().getFullYear()} году
          </p>
        ) : null}
        {weeklyCommentsCount > 0 ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MessageSquare className="size-4" />
            {weeklyCommentsCount} новых комментари{weeklyCommentsCount === 1 ? "й" : "ев"} за неделю
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            className={`group relative overflow-hidden rounded-xl bg-linear-to-br p-6 text-white shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover ${tile.gradient}`}
          >
            <div
              className="pointer-events-none absolute -top-8 -right-8 size-28 rounded-full bg-white/10 transition-transform duration-300 group-hover:scale-110"
              aria-hidden
            />
            <div className="relative flex items-center justify-between gap-2">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
                <tile.icon className="size-5" />
              </div>
              {tile.badge !== undefined && tile.badge > 0 ? (
                <span className="flex size-7 items-center justify-center rounded-full bg-white/20 text-sm font-semibold backdrop-blur-sm">
                  {tile.badge > 99 ? "99+" : tile.badge}
                </span>
              ) : null}
            </div>
            <p className="relative mt-4 text-lg font-semibold tracking-tight">{tile.label}</p>
            {tile.completionPercent !== undefined ? (
              <div className="relative mt-3">
                <Progress value={tile.completionPercent}>
                  <ProgressTrack className="bg-white/20">
                    <ProgressIndicator className="bg-white" />
                  </ProgressTrack>
                </Progress>
                <p className="mt-1 text-xs text-white/80">{tile.completionPercent}% выполнено</p>
              </div>
            ) : null}
          </Link>
        ))}
      </div>
    </div>
  );
}
