"use client";

import { useState } from "react";

import { DeadlineCalendar } from "@/components/calendar/deadline-calendar";
import { GanttChart } from "@/components/gantt/gantt-chart";
import { PulseList } from "@/components/pulse/pulse-list";
import type { CalendarDeadlineItem } from "@/lib/calendar/types";
import type { GanttData } from "@/lib/gantt/queries";
import type { PulseSectionItem } from "@/lib/pulse/queries";
import { cn } from "@/lib/utils";

type ScheduleView = "pulse" | "gantt" | "calendar";

const VIEWS: { value: ScheduleView; label: string }[] = [
  { value: "pulse", label: "Пульс недели" },
  { value: "gantt", label: "Гант" },
  { value: "calendar", label: "Календарь" },
];

// Переключатель "Пульс недели" / "Гант" / "Календарь" внутри одной вкладки —
// используется и на вкладке "Гант" страницы департамента (там разделы одного
// департамента, groupByDepartment=false), и на глобальной странице /gantt
// (2026-08-07: единственный оставшийся в сайдбаре пункт вместо трёх
// отдельных — /pulse и /calendar как роуты остаются, просто без ссылки в
// меню, groupByDepartment=true как раньше на /pulse).
export function ScheduleSwitcher({
  pulseSections,
  ganttData,
  calendarItems,
  groupByDepartment = false,
}: {
  pulseSections: PulseSectionItem[];
  ganttData: GanttData;
  calendarItems: CalendarDeadlineItem[];
  groupByDepartment?: boolean;
}) {
  const [view, setView] = useState<ScheduleView>("pulse");

  return (
    <div className="space-y-4">
      <div className="inline-flex gap-1 rounded-lg border bg-muted/30 p-1">
        {VIEWS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setView(item.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              view === item.value
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {view === "pulse" ? <PulseList sections={pulseSections} groupByDepartment={groupByDepartment} /> : null}
      {view === "gantt" ? <GanttChart data={ganttData} /> : null}
      {view === "calendar" ? <DeadlineCalendar items={calendarItems} /> : null}
    </div>
  );
}
