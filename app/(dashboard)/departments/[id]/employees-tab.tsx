"use client";

import { useState, useTransition } from "react";
import { UserMinus, UserPlus } from "lucide-react";

import {
  addEmployeeToDepartmentAction,
  assignDepartmentManagerAction,
  removeEmployeeFromDepartmentAction,
} from "@/lib/departments/actions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAvatarColor, getInitials } from "@/lib/utils";

type Employee = { id: string; fullName: string; position?: string | null };

const NO_MANAGER = "__none__";

export function EmployeesTab({
  departmentId,
  managerId,
  employees,
  allEmployees,
  canAssignManager,
  canManageEmployees,
}: {
  departmentId: string;
  managerId: string | null;
  employees: Employee[];
  allEmployees: { id: string; fullName: string; homeDepartmentId: string | null }[];
  // Назначение руководителя — структурное решение, только администратор.
  canAssignManager: boolean;
  // Добавлять/убирать рядовых сотрудников может и руководитель ЭТОГО
  // департамента (см. план: "полный контроль над своим департаментом").
  canManageEmployees: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [addEmployeeId, setAddEmployeeId] = useState<string>("");

  const availableToAdd = allEmployees.filter((e) => e.homeDepartmentId !== departmentId);

  function handleAssignManager(value: string | null) {
    setError(null);
    startTransition(async () => {
      try {
        await assignDepartmentManagerAction(departmentId, value === NO_MANAGER || !value ? null : value);
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "Не удалось назначить руководителя",
        );
      }
    });
  }

  function handleAdd() {
    if (!addEmployeeId) return;
    setError(null);
    startTransition(async () => {
      try {
        await addEmployeeToDepartmentAction(departmentId, addEmployeeId);
        setAddEmployeeId("");
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "Не удалось добавить сотрудника",
        );
      }
    });
  }

  function handleRemove(userId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await removeEmployeeFromDepartmentAction(userId, departmentId);
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "Не удалось убрать сотрудника",
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      {canAssignManager ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Руководитель департамента</p>
          <Select
            value={managerId ?? NO_MANAGER}
            onValueChange={handleAssignManager}
            disabled={isPending}
            items={[
              { value: NO_MANAGER, label: "Не назначен" },
              ...employees.map((e) => ({ value: e.id, label: e.fullName })),
            ]}
          >
            <SelectTrigger className="w-full sm:w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_MANAGER}>Не назначен</SelectItem>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Руководитель управляет только этим департаментом: сотрудниками, базовым стеком задач и задачами по проектам в его разделах.
          </p>
        </div>
      ) : null}

      {canManageEmployees ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <p className="text-sm font-medium">Добавить сотрудника</p>
            <Select
              value={addEmployeeId}
              onValueChange={(value) => setAddEmployeeId(value ?? "")}
              disabled={isPending || availableToAdd.length === 0}
              items={availableToAdd.map((e) => ({ value: e.id, label: e.fullName }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    availableToAdd.length === 0 ? "Все сотрудники уже добавлены" : "Выберите сотрудника"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {availableToAdd.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" onClick={handleAdd} disabled={isPending || !addEmployeeId}>
            <UserPlus className="size-4" />
            Добавить
          </Button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="space-y-2">
        {employees.length === 0 ? (
          <p className="text-sm text-muted-foreground">В этом департаменте пока нет сотрудников.</p>
        ) : (
          employees.map((employee) => (
            <div
              key={employee.id}
              className="flex items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: getAvatarColor(employee.id) }}
                >
                  {getInitials(employee.fullName)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{employee.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {employee.position ?? "—"}
                    {employee.id === managerId ? " · Руководитель" : ""}
                  </p>
                </div>
              </div>
              {canManageEmployees ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleRemove(employee.id)}
                  disabled={isPending}
                  title="Убрать из департамента"
                >
                  <UserMinus className="size-4" />
                </Button>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
