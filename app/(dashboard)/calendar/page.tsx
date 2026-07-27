import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { TaskPriority } from "@prisma/client";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getMyTasks } from "@/lib/tasks/queries";
import {
  TASK_PRIORITY_BADGE_VARIANT,
  TASK_PRIORITY_BORDER_COLOR,
  TASK_PRIORITY_DOT_COLOR,
  TASK_PRIORITY_LABELS,
} from "@/lib/projects/status-labels";
import { cn, formatTodayLabel } from "@/lib/utils";

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

// От самого срочного к самому спокойному — определяет и порядок точек в
// ячейке дня (при нехватке места показываем самые срочные), и порядок
// приоритетов в легенде под календарём.
const PRIORITY_URGENCY_ORDER = [
  TaskPriority.СРОЧНЫЙ,
  TaskPriority.ВЫСОКИЙ,
  TaskPriority.СРЕДНИЙ,
  TaskPriority.НИЗКИЙ,
];
const MAX_DOTS_PER_DAY = 4;

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Простая сетка текущего месяца (без переключения месяцев — см. план,
// "moderate simplification"): начинаем с понедельника недели, в которую
// попадает 1-е число, и рисуем ровно 6 строк по 7 дней — этого достаточно
// для любого месяца без выхода за пределы сетки.
function buildMonthGrid(year: number, month: number) {
  const firstOfMonth = new Date(year, month, 1);
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7; // 0 = понедельник
  const gridStart = new Date(year, month, 1 - firstWeekday);

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  }
  return days;
}

export default async function CalendarPage() {
  const tasks = await getMyTasks();
  const deadlineTasks = tasks.filter((t) => t.deadline !== null);

  const today = new Date();
  const days = buildMonthGrid(today.getFullYear(), today.getMonth());
  const monthLabel = today.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });

  const upcoming = [...deadlineTasks].sort(
    (a, b) => a.deadline!.getTime() - b.deadline!.getTime(),
  );

  return (
    <>
      <PageHeader title="Календарь" subtitle={formatTodayLabel(today)} />
      <div className="space-y-6 p-8">
        <Card>
          <CardContent className="space-y-3">
            <p className="text-sm font-medium capitalize">{monthLabel}</p>
            <div className="grid grid-cols-7 gap-1 rounded-lg bg-muted/60 text-center">
              {WEEKDAY_LABELS.map((label, index) => {
                const isWeekend = index === 5 || index === 6;
                return (
                  <div
                    key={label}
                    className={cn(
                      "py-2 text-[13px] font-bold tracking-wide uppercase",
                      isWeekend ? "text-destructive" : "text-foreground",
                    )}
                  >
                    {label}
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
              {days.map((day) => {
                const inMonth = day.getMonth() === today.getMonth();
                const isToday = isSameDay(day, today);
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                const dayTasks = [...deadlineTasks.filter((t) => isSameDay(t.deadline!, day))].sort(
                  (a, b) => PRIORITY_URGENCY_ORDER.indexOf(a.priority) - PRIORITY_URGENCY_ORDER.indexOf(b.priority),
                );
                const hasUrgent = dayTasks.some((t) => t.priority === TaskPriority.СРОЧНЫЙ);
                const visibleDots = dayTasks.slice(0, MAX_DOTS_PER_DAY);
                const hiddenCount = dayTasks.length - visibleDots.length;

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "flex min-h-16 flex-col items-center gap-1 rounded-lg border border-transparent p-1.5",
                      !inMonth && "text-muted-foreground/40",
                      isToday && "border-primary bg-primary/5",
                      hasUrgent && inMonth && "bg-destructive/5",
                    )}
                  >
                    <span
                      className={cn(
                        "text-xs",
                        isWeekend && inMonth && "font-semibold text-destructive",
                        isToday && "font-semibold text-primary",
                      )}
                    >
                      {day.getDate()}
                    </span>
                    {dayTasks.length > 0 ? (
                      <div className="flex flex-wrap items-center justify-center gap-0.5">
                        {visibleDots.map((t) => (
                          <span
                            key={t.id}
                            className={cn("size-1.5 rounded-full", TASK_PRIORITY_DOT_COLOR[t.priority])}
                            title={`${t.title} — ${TASK_PRIORITY_LABELS[t.priority]}`}
                          />
                        ))}
                        {hiddenCount > 0 ? (
                          <span className="text-[10px] leading-none text-muted-foreground">+{hiddenCount}</span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
              {PRIORITY_URGENCY_ORDER.map((priority) => (
                <span key={priority} className="flex items-center gap-1.5">
                  <span className={cn("size-1.5 rounded-full", TASK_PRIORITY_DOT_COLOR[priority])} />
                  {TASK_PRIORITY_LABELS[priority]}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Ближайшие сроки
          </h3>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">Нет задач со сроком.</p>
          ) : (
            <div className="space-y-2">
              {upcoming.map((task) => (
                <Link key={task.id} href={`/projects/${task.projectId}`} className="block">
                  <Card size="sm" hoverable className={cn("border-l-4", TASK_PRIORITY_BORDER_COLOR[task.priority])}>
                    <CardContent className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{task.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{task.projectName}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant={TASK_PRIORITY_BADGE_VARIANT[task.priority]}>
                          {TASK_PRIORITY_LABELS[task.priority]}
                        </Badge>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <CalendarClock className="size-3.5" />
                          {task.deadline!.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
