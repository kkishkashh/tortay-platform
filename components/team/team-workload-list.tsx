import { Card } from "@/components/ui/card";
import type { TeamWorkloadItem } from "@/lib/team/queries";
import { pluralizeProjects } from "@/lib/utils";
import { WORKLOAD_META } from "@/lib/workload";

// Общий рендер списка "Команда/загрузка" — вынесен из /team (2026-08-07),
// чтобы переиспользовать и в переключателе "Гант" (см.
// components/schedule/schedule-switcher.tsx) без дублирования разметки.
export function TeamWorkloadList({ employees }: { employees: TeamWorkloadItem[] }) {
  if (employees.length === 0) {
    return <p className="text-sm text-muted-foreground">В департаменте пока нет сотрудников.</p>;
  }

  return (
    <div className="space-y-2">
      {employees.map((employee) => {
        const meta = WORKLOAD_META[employee.level];
        const totalSignals = employee.pulse.green + employee.pulse.yellow + employee.pulse.red + employee.pulse.none;
        return (
          <Card key={employee.id} className="flex-row items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{employee.fullName}</p>
              <p className="text-xs text-muted-foreground">
                {employee.activeProjectsCount} {pluralizeProjects(employee.activeProjectsCount)} · {meta.label}
              </p>
              <div className="mt-1.5 h-1.5 w-40 rounded-full" style={{ backgroundColor: meta.color }} />
            </div>
            {totalSignals > 0 ? (
              <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                {employee.pulse.green > 0 ? <span>🟢 {employee.pulse.green}</span> : null}
                {employee.pulse.yellow > 0 ? <span>🟡 {employee.pulse.yellow}</span> : null}
                {employee.pulse.red > 0 ? <span>🔴 {employee.pulse.red}</span> : null}
                {employee.pulse.none > 0 ? <span>⚪ {employee.pulse.none} без сигнала</span> : null}
              </div>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}
