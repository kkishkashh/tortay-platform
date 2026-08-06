import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { PulseSectionItem } from "@/lib/pulse/queries";

import { PULSE_SIGNAL_META, PulseSetter } from "./pulse-setter";

function formatDeadline(date: Date | null) {
  if (!date) return "срок не задан";
  return new Date(date).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
}

function PulseSectionCard({ item }: { item: PulseSectionItem }) {
  return (
    <Card className="flex-row items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0 flex-1">
        <Link href={`/projects/${item.projectId}`} className="truncate text-sm font-medium hover:underline">
          {item.projectName}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          {item.sectionName} · {formatDeadline(item.deadline)}
        </p>
        {item.progress !== null ? (
          <div className="mt-1.5 flex items-center gap-2">
            <Progress value={item.progress} className="w-28" />
            <span className="text-xs text-muted-foreground tabular-nums">{item.progress}%</span>
          </div>
        ) : null}
        {item.pulse?.note ? (
          <p className="mt-1 truncate text-xs text-muted-foreground italic">«{item.pulse.note}»</p>
        ) : null}
        {item.pulse ? <p className="text-xs text-muted-foreground">{item.pulse.authorName}</p> : null}
      </div>
      <div className="shrink-0">
        {item.canSetPulse ? (
          <PulseSetter
            sectionId={item.sectionId}
            currentSignal={item.pulse?.signal ?? null}
            currentNote={item.pulse?.note ?? null}
          />
        ) : item.pulse ? (
          <Badge variant="outline">
            {PULSE_SIGNAL_META[item.pulse.signal].emoji} {PULSE_SIGNAL_META[item.pulse.signal].label}
          </Badge>
        ) : (
          <Badge variant="outline">Нет сигнала</Badge>
        )}
      </div>
    </Card>
  );
}

// Общий рендер списка разделов "Пульса недели" — вынесен из /pulse
// (2026-08-06), чтобы переиспользовать и на вкладке "Загрузка и сроки"
// департамента (см. app/(dashboard)/departments/[id]/schedule-tab.tsx) без
// дублирования разметки. groupByDepartment=false — для вкладки ОДНОГО
// департамента группировка избыточна (там и так только его разделы).
export function PulseList({
  sections,
  groupByDepartment = true,
}: {
  sections: PulseSectionItem[];
  groupByDepartment?: boolean;
}) {
  if (sections.length === 0) {
    return <p className="text-sm text-muted-foreground">Активных разделов для отметки пульса сейчас нет.</p>;
  }

  if (!groupByDepartment) {
    return (
      <div className="space-y-2">
        {sections.map((item) => (
          <PulseSectionCard key={item.sectionId} item={item} />
        ))}
      </div>
    );
  }

  const byDepartment = new Map<string, { name: string; color: string; items: PulseSectionItem[] }>();
  for (const section of sections) {
    const group = byDepartment.get(section.departmentId) ?? {
      name: section.departmentName,
      color: section.departmentColor,
      items: [],
    };
    group.items.push(section);
    byDepartment.set(section.departmentId, group);
  }

  return (
    <div className="space-y-6">
      {Array.from(byDepartment.values()).map((group) => (
        <div key={group.name} className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: group.color }} />
            <h2 className="text-sm font-semibold">{group.name}</h2>
          </div>
          <div className="space-y-2">
            {group.items.map((item) => (
              <PulseSectionCard key={item.sectionId} item={item} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
