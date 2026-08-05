import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { EmployeeListItem } from "@/lib/employees/queries";
import { pluralizeProjects } from "@/lib/utils";
import { WORKLOAD_META, WORKLOAD_NONE_COLOR } from "@/lib/workload";

export function EmployeeCard({ employee }: { employee: EmployeeListItem }) {
  const hasProjects = employee.totalProjectsCount > 0;
  const workloadColor = hasProjects
    ? WORKLOAD_META[employee.workload].color
    : WORKLOAD_NONE_COLOR;
  const workloadLabel = hasProjects ? WORKLOAD_META[employee.workload].label : "Нет проектов";

  return (
    <Link href={`/employees/${employee.id}`} className="block">
      <Card hoverable className="h-full">
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <UserAvatar
              avatarUrl={employee.avatarUrl}
              fullName={employee.fullName}
              seed={employee.id}
              className="size-12 text-sm"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="truncate font-medium">{employee.fullName}</p>
                {!employee.isActive ? (
                  <Badge variant="secondary" className="shrink-0">
                    Деактивирован
                  </Badge>
                ) : null}
                {employee.isGip ? (
                  <Badge className="shrink-0" title={employee.gipProjectNames.join(", ")}>
                    ГИП{employee.gipProjectNames.length > 1 ? ` × ${employee.gipProjectNames.length}` : ""}
                  </Badge>
                ) : null}
                {employee.isLead ? (
                  <Badge variant="secondary" className="shrink-0">
                    Лид
                  </Badge>
                ) : null}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {employee.position ?? "—"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-lg font-semibold">{employee.activeProjectsCount}</p>
              <p className="text-[10px] tracking-wide text-muted-foreground uppercase">
                Активных
              </p>
            </div>
            <div>
              <p className="text-lg font-semibold">{employee.completedProjectsCount}</p>
              <p className="text-[10px] tracking-wide text-muted-foreground uppercase">
                Выполнено
              </p>
            </div>
            <div>
              <p className="text-lg font-semibold">{employee.totalProjectsCount}</p>
              <p className="text-[10px] tracking-wide text-muted-foreground uppercase">
                Всего
              </p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-muted-foreground">Загруженность</span>
              <span className="text-muted-foreground">
                {employee.activeProjectsCount}{" "}
                {pluralizeProjects(employee.activeProjectsCount)}
              </span>
            </div>
            <div
              className="mt-1.5 h-1.5 w-full rounded-full"
              style={{ backgroundColor: workloadColor }}
              role="img"
              aria-label={`Загруженность: ${workloadLabel}`}
            />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
