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

// Объединяет "Пульс недели", "Гант" и "Календарь" в одну вкладку страницы
// департамента (2026-08-06, по прямой просьбе) — те же данные и та же
// разметка, что и у одноимённых глобальных страниц (см.
// components/pulse/pulse-list.tsx, components/gantt/gantt-chart.tsx,
// components/calendar/deadline-calendar.tsx), просто отфильтрованные
// заранее под ЭТОТ департамент и без перехода со страницы. Глобальные
// /pulse, /gantt, /calendar в левом меню не трогаем — эта вкладка ничего
// не заменяет, просто даёт ещё один способ добраться до тех же данных, не
// уходя со страницы департамента.
export function ScheduleTab({
  pulseSections,
  ganttData,
  calendarItems,
}: {
  pulseSections: PulseSectionItem[];
  ganttData: GanttData;
  calendarItems: CalendarDeadlineItem[];
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

      {view === "pulse" ? <PulseList sections={pulseSections} groupByDepartment={false} /> : null}
      {view === "gantt" ? <GanttChart data={ganttData} /> : null}
      {view === "calendar" ? <DeadlineCalendar items={calendarItems} /> : null}
    </div>
  );
}
