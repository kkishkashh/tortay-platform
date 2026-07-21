import Link from "next/link";
import { CalendarClock } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getMyTasks } from "@/lib/tasks/queries";
import { TASK_PRIORITY_BADGE_VARIANT, TASK_PRIORITY_LABELS } from "@/lib/projects/status-labels";
import { cn, formatTodayLabel } from "@/lib/utils";

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

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
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label} className="py-1 font-medium">
                  {label}
                </div>
              ))}
              {days.map((day) => {
                const inMonth = day.getMonth() === today.getMonth();
                const isToday = isSameDay(day, today);
                const dayTasks = deadlineTasks.filter((t) => isSameDay(t.deadline!, day));

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "flex min-h-16 flex-col items-center gap-1 rounded-lg border border-transparent p-1.5",
                      !inMonth && "text-muted-foreground/40",
                      isToday && "border-primary bg-primary/5",
                    )}
                  >
                    <span className={cn("text-xs", isToday && "font-semibold text-primary")}>
                      {day.getDate()}
                    </span>
                    {dayTasks.length > 0 ? (
                      <div className="flex flex-wrap justify-center gap-0.5">
                        {dayTasks.slice(0, 3).map((t) => (
                          <span key={t.id} className="size-1.5 rounded-full bg-primary" title={t.title} />
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
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
                  <Card size="sm" hoverable>
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
