import Link from "next/link";

import type { GanttData } from "@/lib/gantt/queries";

const DAY_MS = 24 * 3600 * 1000;
const PADDING_DAYS = 5;

function formatShort(date: Date) {
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

// Гант с базовым/текущим сроком (Phase 3 архитектурного дашборда,
// 2026-07-30, из прототипа ProjecTeam) — тонкая линия базового
// (контрактного) срока раздела, толстая — текущего. Вынесен из /gantt
// (2026-08-06), чтобы переиспользовать и на вкладке "Загрузка и сроки"
// департамента (см. app/(dashboard)/departments/[id]/schedule-tab.tsx) без
// дублирования разметки.
export function GanttChart({ data }: { data: GanttData }) {
  const { projects, rangeStart, rangeEnd } = data;

  if (!rangeStart || !rangeEnd) {
    return <p className="text-sm text-muted-foreground">Пока нет разделов с заданными сроками.</p>;
  }

  const paddedStart = new Date(rangeStart.getTime() - PADDING_DAYS * DAY_MS);
  const paddedEnd = new Date(rangeEnd.getTime() + PADDING_DAYS * DAY_MS);
  const totalSpan = Math.max(paddedEnd.getTime() - paddedStart.getTime(), DAY_MS);

  function pct(date: Date) {
    const clamped = Math.min(Math.max(date.getTime(), paddedStart.getTime()), paddedEnd.getTime());
    return ((clamped - paddedStart.getTime()) / totalSpan) * 100;
  }

  const today = new Date();
  const todayPct = today >= paddedStart && today <= paddedEnd ? pct(today) : null;

  // Месячные засечки — по одной на каждое 1-е число месяца в диапазоне.
  const monthMarks: { label: string; leftPct: number }[] = [];
  const cursor = new Date(paddedStart.getFullYear(), paddedStart.getMonth(), 1);
  while (cursor <= paddedEnd) {
    if (cursor >= paddedStart) {
      monthMarks.push({
        label: cursor.toLocaleDateString("ru-RU", { month: "short", year: "2-digit" }),
        leftPct: pct(cursor),
      });
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return (
    <div className="space-y-2 text-xs text-muted-foreground">
      <p>Тонкая линия — базовый срок, толстая — текущий</p>
      <div className="space-y-8">
        {projects.length === 0 ? (
          <p>Пока нет разделов с заданными сроками.</p>
        ) : (
          projects.map((project) => (
            <div key={project.projectId} className="space-y-2">
              <Link href={`/projects/${project.projectId}`} className="text-sm font-semibold hover:underline">
                {project.projectName}
              </Link>
              <div className="rounded-lg border">
                {/* Шкала месяцев */}
                <div className="relative flex border-b bg-muted/30 pl-48">
                  <div className="relative h-6 flex-1">
                    {monthMarks.map((mark) => (
                      <span
                        key={mark.label + mark.leftPct}
                        className="absolute top-1 -translate-x-1/2 text-[10px] text-muted-foreground"
                        style={{ left: `${mark.leftPct}%` }}
                      >
                        {mark.label}
                      </span>
                    ))}
                  </div>
                </div>

                {project.sections.map((section) => {
                  const hasBaseline = section.baselineStartDate !== null && section.baselineDeadline !== null;
                  const hasCurrent = section.startDate !== null && section.deadline !== null;
                  return (
                    <div key={section.sectionId} className="flex items-center border-b last:border-b-0">
                      <div className="w-48 shrink-0 truncate px-3 py-2.5 text-xs font-medium">
                        {section.sectionName}
                      </div>
                      <div className="relative h-10 flex-1 border-l">
                        {todayPct !== null ? (
                          <div
                            className="absolute inset-y-0 w-px bg-destructive/40"
                            style={{ left: `${todayPct}%` }}
                          />
                        ) : null}
                        {hasBaseline ? (
                          <div
                            className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-muted-foreground/50"
                            style={{
                              left: `${pct(section.baselineStartDate!)}%`,
                              width: `${Math.max(pct(section.baselineDeadline!) - pct(section.baselineStartDate!), 0.5)}%`,
                            }}
                            title={`Базовый срок: ${formatShort(section.baselineStartDate!)} — ${formatShort(section.baselineDeadline!)}`}
                          />
                        ) : null}
                        {hasCurrent ? (
                          <div
                            className="absolute top-2.5 h-5 rounded"
                            style={{
                              left: `${pct(section.startDate!)}%`,
                              width: `${Math.max(pct(section.deadline!) - pct(section.startDate!), 0.5)}%`,
                              backgroundColor: project.departmentColor,
                            }}
                            title={`Текущий срок: ${formatShort(section.startDate!)} — ${formatShort(section.deadline!)}`}
                          />
                        ) : null}
                        {!hasBaseline && !hasCurrent ? (
                          <span className="absolute top-1/2 left-2 -translate-y-1/2 text-[10px] text-muted-foreground">
                            сроки не заданы
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
