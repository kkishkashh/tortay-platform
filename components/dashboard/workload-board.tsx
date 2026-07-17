import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import type { EmployeeWorkload } from "@/lib/dashboard/queries";
import { pluralizeProjects } from "@/lib/utils";
import { WORKLOAD_META } from "@/lib/workload";

export function WorkloadBoard({ employees }: { employees: EmployeeWorkload[] }) {
  return (
    <DashboardPanel title="Загруженность сотрудников">
      {employees.length === 0 ? (
        <p className="text-sm text-muted-foreground">Сотрудников пока нет.</p>
      ) : (
        <ul className="space-y-3">
          {employees.map((employee) => {
            const meta = WORKLOAD_META[employee.level];
            return (
              <li key={employee.id}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate font-medium">{employee.fullName}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {employee.activeProjectsCount}{" "}
                    {pluralizeProjects(employee.activeProjectsCount)} · {meta.label}
                  </span>
                </div>
                <div
                  className="mt-1.5 h-1.5 w-full rounded-full"
                  style={{ backgroundColor: meta.color }}
                  role="img"
                  aria-label={`Загруженность: ${meta.label}`}
                />
              </li>
            );
          })}
        </ul>
      )}
    </DashboardPanel>
  );
}
