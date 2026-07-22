"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { TaskPriority } from "@prisma/client";

import { createProjectAction } from "@/lib/projects/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DepartmentIcon } from "@/components/departments/department-icon";
import { TASK_PRIORITY_LABELS } from "@/lib/projects/status-labels";
import { cn } from "@/lib/utils";

const TASK_PRIORITY_ORDER = [
  TaskPriority.НИЗКИЙ,
  TaskPriority.СРЕДНИЙ,
  TaskPriority.ВЫСОКИЙ,
  TaskPriority.СРОЧНЫЙ,
];

const NONE_VALUE = "__none__";

type Employee = {
  id: string;
  fullName: string;
};

type TaskTemplateItem = {
  id: string;
  title: string;
  description: string | null;
};

type DepartmentOption = {
  id: string;
  name: string;
  code: string;
  color: string;
  icon: string;
  manager: { id: string; fullName: string } | null;
  employees: Employee[];
  taskTemplateItems: TaskTemplateItem[];
};

type NewProjectDialogProps = {
  employees: Employee[];
  departments: DepartmentOption[];
};

// Свои задачи (шаг 4) идентифицируются стабильным клиентским ключом, не
// индексом массива — иначе удаление одной кастомной задачи сдвинуло бы
// назначения (шаг 5) у остальных, см. lib/projects/actions.ts.
type CustomTask = { key: string; title: string };
type TaskAssignment = { assigneeUserId: string; deadline: string; priority: string };

type DepartmentSelectionState = {
  checked: boolean;
  itemIds: Set<string>;
  customTasks: CustomTask[];
  // "" означает "не переопределено" — сервер получит null и вкладка раздела
  // будет показывать реального руководителя департамента как контакт.
  contactManagerId: string;
  taskAssignments: Record<string, TaskAssignment>;
};

function emptySelection(defaultContactManagerId: string): DepartmentSelectionState {
  return {
    checked: false,
    itemIds: new Set(),
    customTasks: [],
    contactManagerId: defaultContactManagerId,
    taskAssignments: {},
  };
}

function taskSlotsFor(
  department: DepartmentOption,
  selection: DepartmentSelectionState,
): { key: string; title: string }[] {
  const slots: { key: string; title: string }[] = [];
  for (const item of department.taskTemplateItems) {
    if (selection.itemIds.has(item.id)) {
      slots.push({ key: item.id, title: item.title });
    }
  }
  for (const custom of selection.customTasks) {
    slots.push({ key: custom.key, title: custom.title });
  }
  return slots;
}

function StepDepartmentTaskPicker({
  department,
  selection,
  onChange,
}: {
  department: DepartmentOption;
  selection: DepartmentSelectionState;
  onChange: (next: DepartmentSelectionState) => void;
}) {
  const [customTaskDraft, setCustomTaskDraft] = useState("");

  function toggleItem(itemId: string) {
    const nextIds = new Set(selection.itemIds);
    if (nextIds.has(itemId)) {
      nextIds.delete(itemId);
    } else {
      nextIds.add(itemId);
    }
    onChange({ ...selection, itemIds: nextIds });
  }

  function addCustomTask() {
    const title = customTaskDraft.trim();
    if (!title) return;
    const key = `custom:${crypto.randomUUID()}`;
    onChange({ ...selection, customTasks: [...selection.customTasks, { key, title }] });
    setCustomTaskDraft("");
  }

  function removeCustomTask(key: string) {
    onChange({
      ...selection,
      customTasks: selection.customTasks.filter((t) => t.key !== key),
    });
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex items-center gap-3 border-b bg-muted/30 p-3">
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-lg text-white"
          style={{ backgroundColor: department.color }}
        >
          <DepartmentIcon name={department.icon} className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{department.name}</span>
      </div>

      <div className="space-y-3 p-3">
        {department.taskTemplateItems.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            В базовом стеке этого департамента пока нет задач.
          </p>
        ) : (
          <div className="space-y-1.5">
            {department.taskTemplateItems.map((item) => (
              <label key={item.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selection.itemIds.has(item.id)}
                  onCheckedChange={() => toggleItem(item.id)}
                />
                {item.title}
              </label>
            ))}
          </div>
        )}

        {selection.customTasks.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {selection.customTasks.map((task) => (
              <span
                key={task.key}
                className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
              >
                {task.title}
                <button
                  type="button"
                  onClick={() => removeCustomTask(task.key)}
                  aria-label={`Убрать задачу «${task.title}»`}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex gap-2">
          <Input
            value={customTaskDraft}
            onChange={(event) => setCustomTaskDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCustomTask();
              }
            }}
            placeholder="+ своя задача"
            className="h-8 flex-1 text-sm"
          />
          <Button type="button" variant="outline" size="sm" onClick={addCustomTask}>
            Добавить
          </Button>
        </div>
      </div>
    </div>
  );
}

function StepTaskAssignments({
  department,
  selection,
  onChange,
}: {
  department: DepartmentOption;
  selection: DepartmentSelectionState;
  onChange: (next: DepartmentSelectionState) => void;
}) {
  const slots = taskSlotsFor(department, selection);

  function updateAssignment(key: string, patch: Partial<TaskAssignment>) {
    const current: TaskAssignment = selection.taskAssignments[key] ?? {
      assigneeUserId: "",
      deadline: "",
      priority: TaskPriority.СРЕДНИЙ,
    };
    onChange({
      ...selection,
      taskAssignments: { ...selection.taskAssignments, [key]: { ...current, ...patch } },
    });
  }

  if (slots.length === 0) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex items-center gap-3 border-b bg-muted/30 p-3">
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-lg text-white"
          style={{ backgroundColor: department.color }}
        >
          <DepartmentIcon name={department.icon} className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{department.name}</span>
      </div>

      <div className="divide-y">
        {slots.map((slot) => {
          const assignment = selection.taskAssignments[slot.key];
          return (
            <div key={slot.key} className="space-y-2 p-3">
              <p className="truncate text-sm font-medium">{slot.title}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Select
                  value={assignment?.assigneeUserId || null}
                  onValueChange={(value) =>
                    updateAssignment(slot.key, { assigneeUserId: value ?? "" })
                  }
                  items={department.employees.map((e) => ({ value: e.id, label: e.fullName }))}
                >
                  <SelectTrigger type="button" className="w-full">
                    <SelectValue placeholder="Не назначен" />
                  </SelectTrigger>
                  <SelectContent>
                    {department.employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  type="date"
                  value={assignment?.deadline ?? ""}
                  onChange={(event) => updateAssignment(slot.key, { deadline: event.target.value })}
                  className="h-8 text-sm"
                />

                <Select
                  value={assignment?.priority || TaskPriority.СРЕДНИЙ}
                  onValueChange={(value) =>
                    updateAssignment(slot.key, { priority: value ?? TaskPriority.СРЕДНИЙ })
                  }
                  items={TASK_PRIORITY_ORDER.map((p) => ({ value: p, label: TASK_PRIORITY_LABELS[p] }))}
                >
                  <SelectTrigger type="button" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_PRIORITY_ORDER.map((p) => (
                      <SelectItem key={p} value={p}>
                        {TASK_PRIORITY_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const STEP_TITLES = [
  "Проект",
  "Департаменты",
  "Контакты",
  "Задачи",
  "Назначения",
];

export function NewProjectDialog({ employees, departments }: NewProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selections, setSelections] = useState<Record<string, DepartmentSelectionState>>({});

  function getSelection(department: DepartmentOption) {
    return selections[department.id] ?? emptySelection(department.manager?.id ?? "");
  }

  function setSelection(departmentId: string, next: DepartmentSelectionState) {
    setSelections((prev) => ({ ...prev, [departmentId]: next }));
  }

  function toggleDepartment(department: DepartmentOption) {
    const current = getSelection(department);
    setSelection(department.id, { ...current, checked: !current.checked });
  }

  function resetAll() {
    setSelections({});
    setStep(1);
  }

  const checkedDepartments = departments.filter((d) => getSelection(d).checked);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createProjectAction(formData);
        setOpen(false);
        resetAll();
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "Не удалось создать проект",
        );
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetAll();
      }}
    >
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" />
        Новый проект
      </DialogTrigger>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>
            Новый проект — шаг {step} из 5: {STEP_TITLES[step - 1]}
          </DialogTitle>
        </DialogHeader>

        <form action={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          {/* Шаг 1 — основные поля проекта, ГИП, договор */}
          <div className={cn("space-y-4", step !== 1 && "hidden")}>
            <div className="space-y-2">
              <Label htmlFor="name">Название проекта</Label>
              <Input id="name" name="name" required autoFocus={step === 1} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="client">Заказчик</Label>
                <Input id="client" name="client" placeholder='ТОО "Заказчик"' />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Локация</Label>
                <Input id="location" name="location" placeholder="Алматы" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">Дата начала</Label>
                <Input id="startDate" name="startDate" type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Дата окончания</Label>
                <Input id="endDate" name="endDate" type="date" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Описание</Label>
              <Textarea id="description" name="description" rows={3} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gipUserId">ГИП</Label>
              <Select
                name="gipUserId"
                required
                items={employees.map((employee) => ({
                  value: employee.id,
                  label: employee.fullName,
                }))}
              >
                <SelectTrigger type="button" id="gipUserId" className="w-full">
                  <SelectValue placeholder="Выберите сотрудника" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Договор (необязательно)
              </p>
              <div className="space-y-2">
                <Label htmlFor="binIin">БИН заказчика</Label>
                <Input id="binIin" name="binIin" placeholder="123456789012" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="totalAmount">Стоимость договора</Label>
                <Input
                  id="totalAmount"
                  name="totalAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Например, 5000000"
                />
              </div>
            </div>
          </div>

          {/* Шаг 2 — только чекбоксы департаментов */}
          <div className={cn("space-y-2", step !== 2 && "hidden")}>
            <Label>Департаменты</Label>
            {departments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Департаментов пока нет.</p>
            ) : (
              <div className="space-y-2">
                {departments.map((department) => {
                  const selection = getSelection(department);
                  return (
                    <label
                      key={department.id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border p-3"
                    >
                      <Checkbox
                        checked={selection.checked}
                        onCheckedChange={() => toggleDepartment(department)}
                      />
                      <span
                        className="flex size-7 shrink-0 items-center justify-center rounded-lg text-white"
                        style={{ backgroundColor: department.color }}
                      >
                        <DepartmentIcon name={department.icon} className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {department.name}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Шаг 3 — контакт по каждому выбранному департаменту */}
          <div className={cn("space-y-3", step !== 3 && "hidden")}>
            <Label>Контактные лица по департаментам</Label>
            {checkedDepartments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Сначала выберите департаменты на предыдущем шаге.
              </p>
            ) : (
              checkedDepartments.map((department) => {
                const selection = getSelection(department);
                const options = [
                  ...(department.manager ? [department.manager] : []),
                  ...department.employees.filter((e) => e.id !== department.manager?.id),
                ];
                return (
                  <div key={department.id} className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="flex size-6 shrink-0 items-center justify-center rounded-md text-white"
                        style={{ backgroundColor: department.color }}
                      >
                        <DepartmentIcon name={department.icon} className="size-3" />
                      </span>
                      <span className="text-sm font-medium">{department.name}</span>
                    </div>
                    {options.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        В этом департаменте пока некому быть контактом.
                      </p>
                    ) : (
                      <Select
                        value={selection.contactManagerId || NONE_VALUE}
                        onValueChange={(value) =>
                          setSelection(department.id, {
                            ...selection,
                            contactManagerId: value && value !== NONE_VALUE ? value : "",
                          })
                        }
                        items={[
                          { value: NONE_VALUE, label: department.manager ? `${department.manager.fullName} (по умолчанию)` : "Не назначен" },
                          ...options.map((o) => ({ value: o.id, label: o.fullName })),
                        ]}
                      >
                        <SelectTrigger type="button" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE_VALUE}>
                            {department.manager
                              ? `${department.manager.fullName} (по умолчанию)`
                              : "Не назначен"}
                          </SelectItem>
                          {options.map((o) => (
                            <SelectItem key={o.id} value={o.id}>
                              {o.fullName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Шаг 4 — базовый стек задач + свои задачи, по департаментам */}
          <div className={cn("space-y-2", step !== 4 && "hidden")}>
            <Label>Задачи по департаментам</Label>
            {checkedDepartments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Сначала выберите департаменты на шаге 2.
              </p>
            ) : (
              <div className="space-y-2">
                {checkedDepartments.map((department) => (
                  <StepDepartmentTaskPicker
                    key={department.id}
                    department={department}
                    selection={getSelection(department)}
                    onChange={(next) => setSelection(department.id, next)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Шаг 5 — исполнитель/срок/приоритет по каждой задаче */}
          <div className={cn("space-y-2", step !== 5 && "hidden")}>
            <Label>Назначение задач (необязательно)</Label>
            {checkedDepartments.every((d) => taskSlotsFor(d, getSelection(d)).length === 0) ? (
              <p className="text-sm text-muted-foreground">
                На шаге 4 не выбрано ни одной задачи — проект будет создан без задач.
              </p>
            ) : (
              <div className="space-y-3">
                {checkedDepartments.map((department) => (
                  <StepTaskAssignments
                    key={department.id}
                    department={department}
                    selection={getSelection(department)}
                    onChange={(next) => setSelection(department.id, next)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Скрытые поля со снапшотом состояния — присутствуют независимо от
              того, какой шаг сейчас виден, чтобы FormData на финальном submit
              содержала данные со всех шагов (см. план, D5). */}
          {checkedDepartments.map((department) => {
            const selection = getSelection(department);
            const payload = JSON.stringify({
              checkedTemplateItemIds: Array.from(selection.itemIds),
              customTasks: selection.customTasks,
              contactManagerId: selection.contactManagerId || null,
              taskAssignments: selection.taskAssignments,
            });
            return (
              <div key={department.id}>
                <input type="hidden" name="departmentIds" value={department.id} />
                <input type="hidden" name={`deptData_${department.id}`} value={payload} />
              </div>
            );
          })}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex items-center justify-between gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1 || isPending}
            >
              Назад
            </Button>
            {step < 5 ? (
              // key намеренно отличается от кнопки "Создать" ниже: обе — один
              // и тот же компонент Button в одной позиции дерева, и без разных
              // key React переиспользовал бы тот же DOM-узел, просто поменяв
              // ему type="button" → "submit" на месте. Тогда браузер, уже
              // выполняя действие по умолчанию для ИСХОДНОГО клика (которое
              // применяется ПОСЛЕ обработчика onClick), увидел бы обновлённый
              // type="submit" на том же узле и отправил форму — то есть клик
              // по "Далее" на шаге 4 самопроизвольно создавал бы проект.
              <Button key="next" type="button" onClick={() => setStep((s) => Math.min(5, s + 1))}>
                Далее
                <ChevronDown className="size-4 -rotate-90" />
              </Button>
            ) : (
              <Button key="submit" type="submit" disabled={isPending}>
                {isPending ? "Создаём…" : "Создать"}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
