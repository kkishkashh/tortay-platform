import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { DepartmentIcon } from "@/components/departments/department-icon";
import type { DepartmentListItem } from "@/lib/departments/queries";
import { pluralizeEmployees } from "@/lib/utils";

// nameOnly — для рядового сотрудника (см. страницу-список): он видит,
// какие департаменты вообще есть в компании, но не их состав/статистику/
// руководителя, и карточка никуда не ведёт (страница департамента
// по-прежнему доступна только руководителю/админу).
export function DepartmentCard({
  department,
  nameOnly = false,
}: {
  department: DepartmentListItem;
  nameOnly?: boolean;
}) {
  const card = (
    <Card hoverable={!nameOnly} className="h-full overflow-hidden">
      <div className="h-1.5 w-full" style={{ backgroundColor: department.color }} />
      <CardContent className="flex flex-col gap-4 pt-2">
        <div className="flex items-start gap-3">
          <span
            className="flex size-11 shrink-0 items-center justify-center rounded-xl text-white"
            style={{ backgroundColor: department.color }}
          >
            <DepartmentIcon name={department.icon} className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">{department.name}</p>
            <p className="truncate text-xs text-muted-foreground">{department.code}</p>
          </div>
        </div>

        {nameOnly ? null : (
          <>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div>
                <p className="text-lg font-semibold">{department.employeesCount}</p>
                <p className="text-[10px] tracking-wide text-muted-foreground uppercase">
                  {pluralizeEmployees(department.employeesCount)}
                </p>
              </div>
              <div>
                <p className="text-lg font-semibold">{department.taskStackCount}</p>
                <p className="text-[10px] tracking-wide text-muted-foreground uppercase">
                  В базовом стеке
                </p>
              </div>
            </div>

            <div className="border-t pt-3 text-xs text-muted-foreground">
              {department.managers.length > 0 ? (
                <>
                  {department.managers.length > 1 ? "Руководители" : "Руководитель"}:{" "}
                  <span className="text-foreground">
                    {department.managers.map((m) => m.fullName).join(", ")}
                  </span>
                </>
              ) : (
                "Руководитель не назначен"
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );

  if (nameOnly) {
    return card;
  }

  return (
    <Link href={`/departments/${department.id}`} className="block">
      {card}
    </Link>
  );
}
