"use client";

import { useState, useTransition } from "react";

import { addDepartmentManagerAction, removeDepartmentManagerAction } from "@/lib/departments/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Department = { id: string; name: string };

// Кем руководит этот сотрудник — отдельно от homeDepartmentId (в каком
// департаменте он состоит, редактируется в DetailsForm). Один человек может
// руководить несколькими департаментами одновременно, поэтому это набор
// переключаемых бейджей, а не select. Переиспользует те же server actions,
// что и страница департамента (app/(dashboard)/departments/[id]/employees-tab.tsx)
// — назначение руководителя остаётся одной операцией с одной проверкой прав
// (canManageDepartments), просто доступной теперь и отсюда.
export function ManagedDepartmentsCard({
  userId,
  departments,
  managedDepartmentIds,
}: {
  userId: string;
  departments: Department[];
  managedDepartmentIds: string[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [managedIds, setManagedIds] = useState(new Set(managedDepartmentIds));

  function toggle(departmentId: string) {
    setError(null);
    const isManaging = managedIds.has(departmentId);
    startTransition(async () => {
      try {
        if (isManaging) {
          await removeDepartmentManagerAction(departmentId, userId);
        } else {
          await addDepartmentManagerAction(departmentId, userId);
        }
        setManagedIds((prev) => {
          const next = new Set(prev);
          if (isManaging) {
            next.delete(departmentId);
          } else {
            next.add(departmentId);
          }
          return next;
        });
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "Не удалось изменить руководство департаментом",
        );
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Руководство департаментами</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {departments.map((department) => {
            const isManaging = managedIds.has(department.id);
            return (
              <Button
                key={department.id}
                type="button"
                variant={isManaging ? "default" : "outline"}
                size="sm"
                disabled={isPending}
                onClick={() => toggle(department.id)}
              >
                {isManaging ? <Badge variant="secondary" className="mr-1">✓</Badge> : null}
                {department.name}
              </Button>
            );
          })}
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <p className="text-xs text-muted-foreground">
          Нажмите на департамент, чтобы назначить или снять этого сотрудника с руководства им. Можно
          руководить несколькими департаментами одновременно.
        </p>
      </CardContent>
    </Card>
  );
}
