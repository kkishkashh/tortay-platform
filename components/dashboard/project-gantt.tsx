import { Fragment } from "react";

import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import type { ProjectTimeline } from "@/lib/dashboard/queries";

const MONTH_LABELS = [
  "Янв", "Фев", "Мар", "Апр", "Май", "Июн",
  "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек",
];

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, count: number) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function buildMonths(rangeStart: Date, lastVisibleDate: Date) {
  const months: { key: string; label: string }[] = [];
  let cursor = startOfMonth(rangeStart);
  const last = startOfMonth(lastVisibleDate);
  while (cursor <= last) {
    months.push({
      key: `${cursor.getFullYear()}-${cursor.getMonth()}`,
      label: `${MONTH_LABELS[cursor.getMonth()]} ${cursor.getFullYear()}`,
    });
    cursor = addMonths(cursor, 1);
  }
  return months;
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function ProjectGantt({ timelines }: { timelines: ProjectTimeline[] }) {
  if (timelines.length === 0) {
    return (
      <DashboardPanel title="График проектов">
        <p className="text-sm text-muted-foreground">
          Нет проектов с заданными сроками разделов — задайте даты начала и
          окончания у разделов на странице проекта, и они появятся здесь.
        </p>
      </DashboardPanel>
    );
  }

  const rangeStart = startOfMonth(
    new Date(Math.min(...timelines.map((timeline) => timeline.startDate.getTime()))),
  );
  const latestDeadline = new Date(
    Math.max(...timelines.map((timeline) => timeline.deadline.getTime())),
  );
  const rangeEnd = addMonths(startOfMonth(latestDeadline), 1);
  const months = buildMonths(rangeStart, latestDeadline);
  const totalMs = rangeEnd.getTime() - rangeStart.getTime();
  const monthWidthPercent = 100 / months.length;

  return (
    <DashboardPanel title="График проектов">
      <div className="overflow-x-auto">
        <div className="min-w-[420px]">
          <div className="grid" style={{ gridTemplateColumns: "120px 1fr" }}>
            <div />
            <div
              className="grid"
              style={{ gridTemplateColumns: `repeat(${months.length}, 1fr)` }}
            >
              {months.map((month) => (
                <div
                  key={month.key}
                  className="truncate border-l px-1.5 py-1 text-center text-[10px] text-muted-foreground"
                >
                  {month.label}
                </div>
              ))}
            </div>

            {timelines.map((project) => {
              const leftPercent =
                ((project.startDate.getTime() - rangeStart.getTime()) / totalMs) * 100;
              const widthPercent = Math.max(
                ((project.deadline.getTime() - project.startDate.getTime()) / totalMs) * 100,
                2,
              );

              return (
                <Fragment key={project.id}>
                  <div className="truncate border-t px-1.5 py-2 text-xs font-medium">
                    {project.name}
                  </div>
                  <div
                    className="relative border-t"
                    style={{
                      backgroundImage: `repeating-linear-gradient(to right, transparent, transparent calc(${monthWidthPercent}% - 1px), var(--border) calc(${monthWidthPercent}% - 1px), var(--border) ${monthWidthPercent}%)`,
                    }}
                  >
                    <div
                      className="absolute inset-y-1.5 flex items-center overflow-hidden rounded bg-primary px-1.5"
                      style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                      title={`${project.name}: ${formatShortDate(project.startDate)}–${formatShortDate(project.deadline)}`}
                    >
                      <span className="truncate text-[9px] font-medium whitespace-nowrap text-primary-foreground">
                        {formatShortDate(project.startDate)}–{formatShortDate(project.deadline)}
                      </span>
                    </div>
                  </div>
                </Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </DashboardPanel>
  );
}
