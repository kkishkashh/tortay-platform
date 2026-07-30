import { redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getPulseDashboard, hasPulseAccess } from "@/lib/pulse/queries";
import { weekLabel } from "@/lib/pulse/week";

import { PULSE_SIGNAL_META, PulseSetter } from "./pulse-setter";

function formatDeadline(date: Date | null) {
  if (!date) return "срок не задан";
  return new Date(date).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
}

// "Пульс недели" (Phase 1 дашборда департамента Архитектуры, 2026-07-30) —
// еженедельный сигнал-статус по разделам вместо ежедневных отчётов, из
// прототипа ProjecTeam. Доступен только пользователям с видимым
// департаментом, где включён Department.usesPulseTracking (см.
// hasPulseAccess) — сейчас это Архитектура.
export default async function PulsePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  if (!(await hasPulseAccess(session.user))) {
    redirect("/");
  }

  const { isoWeek, sections } = await getPulseDashboard(session.user);

  const byDepartment = new Map<string, { name: string; color: string; items: typeof sections }>();
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
    <>
      <PageHeader title="Пульс недели" subtitle={`Неделя: ${weekLabel(isoWeek)}`} />
      <div className="space-y-6 p-8">
        {sections.length === 0 ? (
          <p className="text-sm text-muted-foreground">Активных разделов для отметки пульса сейчас нет.</p>
        ) : (
          Array.from(byDepartment.values()).map((group) => (
            <div key={group.name} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: group.color }} />
                <h2 className="text-sm font-semibold">{group.name}</h2>
              </div>
              <div className="space-y-2">
                {group.items.map((item) => (
                  <Card key={item.sectionId} className="flex-row items-center justify-between gap-4 px-4 py-3">
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
                      {item.pulse ? (
                        <p className="text-xs text-muted-foreground">{item.pulse.authorName}</p>
                      ) : null}
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
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
