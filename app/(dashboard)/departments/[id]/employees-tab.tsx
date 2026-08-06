"use client";

import { useState, useTransition } from "react";
import { UserMinus, UserPlus } from "lucide-react";

import {
  addDepartmentManagerAction,
  addEmployeeToDepartmentAction,
  removeDepartmentManagerAction,
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
import type { DepartmentManagerItem, ManagerCandidate } from "@/lib/departments/queries";
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

export function EmployeesTab({
  departmentId,
  managers,
  employees,
  allEmployees,
  managerCandidates,
  canAssignManager,
  canManageEmployees,
}: {
  departmentId: string;
  managers: DepartmentManagerItem[];
  employees: Employee[];
  allEmployees: { id: string; fullName: string; homeDepartmentId: string | null; position: string | null }[];
  // Все штатные сотрудники компании — НЕ ограничено сотрудниками этого
  // департамента и НЕ исключает тех, кто уже руководит другим департаментом
  // (один человек может руководить несколькими департаментами одновременно,
  // см. lib/departments/queries.ts::getEmployeesForManagerAssignment).
  managerCandidates: ManagerCandidate[];
  // Назначение руководителя — раньше было строго "только администратор",
  // с 2026-08-06 (по прямой просьбе) руководитель ЭТОГО департамента тоже
  // может добавить/снять соруководителя (напр. ГАП в Архитектуре) —
  // см. lib/departments/actions.ts::addDepartmentManagerAction.
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
  const [addManagerId, setAddManagerId] = useState<string>("");
  const [addManagerPickerResetKey, setAddManagerPickerResetKey] = useState(0);

  const availableToAdd = allEmployees.filter((e) => e.homeDepartmentId !== departmentId);

  // С 2026-07-31 у департамента может быть несколько руководителей — пикер
  // "добавить руководителя" исключает тех, кто УЖЕ руководит ЭТИМ
  // департаментом (остальные кандидаты остаются, включая руководителей
  // других департаментов — один человек может руководить несколькими сразу).
  const managerIds = new Set(managers.map((m) => m.id));
  const eligibleManagerCandidates = managerCandidates.filter((c) => !managerIds.has(c.id));
  const currentManagersElsewhere = eligibleManagerCandidates.filter(
    (c) => c.managedDepartmentNames.length > 0,
  );
  const plainStaff = eligibleManagerCandidates.filter((c) => c.managedDepartmentNames.length === 0);

  const toPickerItem = (c: ManagerCandidate): PickerItem => ({
    value: c.id,
    label: c.fullName,
    sublabel:
      c.managedDepartmentNames.length > 0
        ? `Руководит: ${c.managedDepartmentNames.join(", ")}`
        : (c.position ?? undefined),
  });

  const addManagerGroups: PickerGroup[] = [
    ...(currentManagersElsewhere.length > 0
      ? [{ label: "Уже руководят другим департаментом", items: currentManagersElsewhere.map(toPickerItem) }]
      : []),
    ...(plainStaff.length > 0
      ? [{ label: "Сотрудники", items: plainStaff.map(toPickerItem) }]
      : []),
  ];

  const addEmployeeItems: PickerItem[] = availableToAdd.map((e) => ({
    value: e.id,
    label: e.fullName,
    sublabel: e.position ?? undefined,
  }));

  function handleAddManager() {
    if (!addManagerId) return;
    setError(null);
    startTransition(async () => {
      try {
        await addDepartmentManagerAction(departmentId, addManagerId);
        setAddManagerId("");
        setAddManagerPickerResetKey((key) => key + 1);
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "Не удалось назначить руководителя",
        );
      }
    });
  }

  function handleRemoveManager(userId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await removeDepartmentManagerAction(departmentId, userId);
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "Не удалось снять руководителя",
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
          <p className="text-sm font-medium">
            {managers.length > 1 ? "Руководители департамента" : "Руководитель департамента"}
          </p>

          {managers.length > 0 ? (
            <div className="space-y-2">
              {managers.map((manager) => (
                <div
                  key={manager.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                      style={{ backgroundColor: getAvatarColor(manager.id) }}
                    >
                      {getInitials(manager.fullName)}
                    </span>
                    <p className="truncate text-sm font-medium">{manager.fullName}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleRemoveManager(manager.id)}
                    disabled={isPending}
                    title="Снять с руководства"
                  >
                    <UserMinus className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Руководитель не назначен.</p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Combobox
                key={addManagerPickerResetKey}
                items={addManagerGroups}
                onValueChange={(item) => setAddManagerId(item?.value ?? "")}
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
            </div>
            <Button type="button" onClick={handleAddManager} disabled={isPending || !addManagerId}>
              <UserPlus className="size-4" />
              Назначить руководителем
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Руководитель управляет только этим департаментом: сотрудниками, базовым стеком задач и
            задачами по проектам в его разделах. У департамента может быть несколько руководителей —
            у всех одинаковые права.
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
                    {managerIds.has(employee.id) ? " · Руководитель" : ""}
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
