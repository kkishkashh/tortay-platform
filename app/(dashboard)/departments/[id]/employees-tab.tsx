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
  Combobox,
  ComboboxClear,
  ComboboxCollection,
  ComboboxContent,
  ComboboxGroup,
  ComboboxGroupLabel,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
} from "@/components/ui/combobox";
import type { ManagerCandidate } from "@/lib/departments/queries";
import { getAvatarColor, getInitials } from "@/lib/utils";

type Employee = { id: string; fullName: string; position?: string | null };

// Элемент пикера с поиском (Combobox) — sublabel показывается под именем в
// списке и участвует в поиске (должность/чем руководит), но не попадает в
// текст самого поля ввода после выбора (это отдельно от itemToStringLabel).
type PickerItem = { value: string; label: string; sublabel?: string };
// Группа для пикера руководителя — "Уже руководят департаментом" /
// "Сотрудники", чтобы сразу было видно, кто есть кто, а не искать глазами
// по подписи в одном большом списке (см. план: "чёткое разделение").
type PickerGroup = { label: string | null; items: PickerItem[] };

function comboboxFilter(item: PickerItem, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    item.label.toLowerCase().includes(q) || (item.sublabel?.toLowerCase().includes(q) ?? false)
  );
}

const NO_MANAGER = "__none__";

export function EmployeesTab({
  departmentId,
  managerId,
  employees,
  allEmployees,
  managerCandidates,
  canAssignManager,
  canManageEmployees,
}: {
  departmentId: string;
  managerId: string | null;
  employees: Employee[];
  allEmployees: { id: string; fullName: string; homeDepartmentId: string | null; position: string | null }[];
  // Все штатные сотрудники компании — НЕ ограничено сотрудниками этого
  // департамента и НЕ исключает тех, кто уже руководит другим департаментом
  // (один человек может руководить несколькими департаментами одновременно,
  // см. lib/departments/queries.ts::getEmployeesForManagerAssignment).
  managerCandidates: ManagerCandidate[];
  // Назначение руководителя — структурное решение, только администратор.
  canAssignManager: boolean;
  // Добавлять/убирать рядовых сотрудников может и руководитель ЭТОГО
  // департамента (см. план: "полный контроль над своим департаментом").
  canManageEmployees: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [addEmployeeId, setAddEmployeeId] = useState<string>("");
  // Меняется после каждого добавления, чтобы Combobox размонтировался и
  // очистил введённый текст поиска — у него нет отдельного пропа для сброса
  // введённого текста без сброса выбранного значения.
  const [addPickerResetKey, setAddPickerResetKey] = useState(0);

  const availableToAdd = allEmployees.filter((e) => e.homeDepartmentId !== departmentId);

  const currentManagers = managerCandidates.filter((c) => c.managedDepartmentNames.length > 0);
  const plainStaff = managerCandidates.filter((c) => c.managedDepartmentNames.length === 0);

  const toPickerItem = (c: ManagerCandidate): PickerItem => ({
    value: c.id,
    label: c.fullName,
    sublabel:
      c.managedDepartmentNames.length > 0
        ? `Руководит: ${c.managedDepartmentNames.join(", ")}`
        : (c.position ?? undefined),
  });

  const managerGroups: PickerGroup[] = [
    { label: null, items: [{ value: NO_MANAGER, label: "Не назначен" }] },
    ...(currentManagers.length > 0
      ? [{ label: "Уже руководят департаментом", items: currentManagers.map(toPickerItem) }]
      : []),
    ...(plainStaff.length > 0
      ? [{ label: "Сотрудники", items: plainStaff.map(toPickerItem) }]
      : []),
  ];
  const managerItems: PickerItem[] = managerGroups.flatMap((group) => group.items);
  const selectedManagerItem = managerItems.find((i) => i.value === (managerId ?? NO_MANAGER)) ?? null;

  const addEmployeeItems: PickerItem[] = availableToAdd.map((e) => ({
    value: e.id,
    label: e.fullName,
    sublabel: e.position ?? undefined,
  }));

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
        setAddPickerResetKey((key) => key + 1);
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
          <Combobox
            items={managerGroups}
            value={selectedManagerItem}
            onValueChange={(item) => handleAssignManager(item?.value ?? null)}
            isItemEqualToValue={(a, b) => a.value === b.value}
            itemToStringLabel={(item) => item.label}
            filter={comboboxFilter}
            disabled={isPending}
          >
            <ComboboxInputGroup className="w-full sm:w-80">
              <ComboboxInput placeholder="Найти сотрудника…" />
              <ComboboxClear />
            </ComboboxInputGroup>
            <ComboboxContent emptyMessage="Никого не нашлось">
              {(group: PickerGroup) => (
                <ComboboxGroup key={group.label ?? "__unlabeled__"} items={group.items}>
                  {group.label ? <ComboboxGroupLabel>{group.label}</ComboboxGroupLabel> : null}
                  <ComboboxCollection>
                    {(item: PickerItem) => (
                      <ComboboxItem key={item.value} value={item}>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate">{item.label}</span>
                          {item.sublabel ? (
                            <span className="truncate text-xs text-muted-foreground">{item.sublabel}</span>
                          ) : null}
                        </div>
                      </ComboboxItem>
                    )}
                  </ComboboxCollection>
                </ComboboxGroup>
              )}
            </ComboboxContent>
          </Combobox>
          <p className="text-xs text-muted-foreground">
            Руководитель управляет только этим департаментом: сотрудниками, базовым стеком задач и задачами по проектам в его разделах.
          </p>
        </div>
      ) : null}

      {canManageEmployees ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <p className="text-sm font-medium">Добавить сотрудника</p>
            <Combobox
              key={addPickerResetKey}
              items={addEmployeeItems}
              onValueChange={(item) => setAddEmployeeId(item?.value ?? "")}
              itemToStringLabel={(item) => item.label}
              filter={comboboxFilter}
              disabled={isPending || availableToAdd.length === 0}
            >
              <ComboboxInputGroup className="w-full">
                <ComboboxInput
                  placeholder={
                    availableToAdd.length === 0 ? "Все сотрудники уже добавлены" : "Найти сотрудника…"
                  }
                />
                <ComboboxClear />
              </ComboboxInputGroup>
              <ComboboxContent emptyMessage="Никого не нашлось">
                {(item: PickerItem) => (
                  <ComboboxItem key={item.value} value={item}>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate">{item.label}</span>
                      {item.sublabel ? (
                        <span className="truncate text-xs text-muted-foreground">{item.sublabel}</span>
                      ) : null}
                    </div>
                  </ComboboxItem>
                )}
              </ComboboxContent>
            </Combobox>
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
