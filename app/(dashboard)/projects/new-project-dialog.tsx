"use client";

import { useRef, useState, useTransition } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { TaskPriority, TaskStackCategory } from "@prisma/client";

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

type TaskTemplateSubItem = {
  id: string;
  title: string;
};

type TaskTemplateItem = {
  id: string;
  title: string;
  description: string | null;
  category: TaskStackCategory;
  subItems: TaskTemplateSubItem[];
};

type DepartmentOption = {
  id: string;
  name: string;
  code: string;
  color: string;
  icon: string;
  allowsLeadRole: boolean;
  managers: { id: string; fullName: string }[];
  employees: Employee[];
  taskTemplateItems: TaskTemplateItem[];
};

type NewProjectDialogProps = {
  employees: Employee[];
  departments: DepartmentOption[];
  // По прямой просьбе Камилы (2026-07-30): свой департамент отмечается
  // галочкой сразу при открытии мастера — руководителю не нужно искать
  // его среди всех департаментов компании. null у администратора/
  // бухгалтера — им ничего не предвыбираем.
  currentUserId: string | null;
};

// Свои задачи (шаг 4) идентифицируются стабильным клиентским ключом, не
// индексом массива — иначе удаление одной кастомной задачи сдвинуло бы
// назначения (шаг 5) у остальных, см. lib/projects/actions.ts.
type CustomTask = { key: string; title: string };
type TaskAssignment = { assigneeUserId: string; deadline: string; priority: string };

type DepartmentSelectionState = {
  checked: boolean;
  itemIds: Set<string>;
  // Подпункты (чек-лист) отмеченных пунктов — плоский набор id, id
  // подпунктов глобально уникальны, привязка к родителю не нужна.
  subItemIds: Set<string>;
  customTasks: CustomTask[];
  // "" означает "не переопределено" — сервер получит null и вкладка раздела
  // будет показывать реального руководителя департамента как контакт.
  contactManagerId: string;
  // "" — Лид на этот проект не назначен (необязательно, см. план 2026-07-30).
  // Это ПРОЕКТНАЯ роль (ProjectMember.projectRole = ВЕДУЩИЙ_СПЕЦИАЛИСТ),
  // не то же самое, что персистентная орг-иерархия "Лид" (User.reportsToId,
  // см. PRD #3 Phase 3) — можно назначить любого сотрудника департамента,
  // а не только уже действующего орг-Лида.
  leadUserId: string;
  // Команда проекта по этому департаменту — если непусто, шаг "Задачи"
  // предлагает назначать исполнителей ТОЛЬКО из Лида+команды, а не из
  // всех сотрудников департамента (см. StepTaskAssignments).
  teamMemberIds: Set<string>;
  taskAssignments: Record<string, TaskAssignment>;
};

function emptySelection(defaultContactManagerId: string): DepartmentSelectionState {
  return {
    checked: false,
    itemIds: new Set(),
    subItemIds: new Set(),
    customTasks: [],
    contactManagerId: defaultContactManagerId,
    leadUserId: "",
    teamMemberIds: new Set(),
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
  // Нестандартный стек свёрнут по умолчанию — те же задачи по структуре,
  // но встречаются реже, не должны загромождать основной список (см. план).
  const [showNonStandard, setShowNonStandard] = useState(false);

  // Отметить пункт — заодно по умолчанию отмечает ВСЕ его подпункты (чек-лист
  // войдёт в задачу целиком); снять пункт — снимает и его подпункты.
  // Отдельные подпункты можно потом донастроить галочками ниже.
  function toggleItem(item: TaskTemplateItem) {
    const nextIds = new Set(selection.itemIds);
    const nextSubIds = new Set(selection.subItemIds);
    if (nextIds.has(item.id)) {
      nextIds.delete(item.id);
      for (const sub of item.subItems) nextSubIds.delete(sub.id);
    } else {
      nextIds.add(item.id);
      for (const sub of item.subItems) nextSubIds.add(sub.id);
    }
    onChange({ ...selection, itemIds: nextIds, subItemIds: nextSubIds });
  }

  function toggleSubItem(subItemId: string) {
    const nextSubIds = new Set(selection.subItemIds);
    if (nextSubIds.has(subItemId)) {
      nextSubIds.delete(subItemId);
    } else {
      nextSubIds.add(subItemId);
    }
    onChange({ ...selection, subItemIds: nextSubIds });
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

  function renderItemRow(item: TaskTemplateItem) {
    return (
      <div key={item.id}>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={selection.itemIds.has(item.id)}
            onCheckedChange={() => toggleItem(item)}
          />
          {item.title}
        </label>
        {selection.itemIds.has(item.id) && item.subItems.length > 0 ? (
          <div className="mt-1 ml-6 space-y-1 border-l pl-3">
            {item.subItems.map((sub) => (
              <label key={sub.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={selection.subItemIds.has(sub.id)}
                  onCheckedChange={() => toggleSubItem(sub.id)}
                />
                {sub.title}
              </label>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  const baseItems = department.taskTemplateItems.filter(
    (item) => item.category === TaskStackCategory.БАЗОВЫЙ,
  );
  const nonStandardItems = department.taskTemplateItems.filter(
    (item) => item.category === TaskStackCategory.НЕСТАНДАРТНЫЙ,
  );

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
        {baseItems.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            В базовом стеке этого департамента пока нет задач.
          </p>
        ) : (
          <div className="space-y-1.5">{baseItems.map((item) => renderItemRow(item))}</div>
        )}

        {nonStandardItems.length > 0 ? (
          <div className="border-t pt-2">
            <button
              type="button"
              onClick={() => setShowNonStandard((v) => !v)}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className={cn("size-3.5 transition-transform", showNonStandard && "rotate-180")} />
              Нестандартный стек ({nonStandardItems.length})
            </button>
            {showNonStandard ? (
              <div className="mt-2 space-y-1.5">{nonStandardItems.map((item) => renderItemRow(item))}</div>
            ) : null}
          </div>
        ) : null}

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

// Если на шаге "Команда" отметили конкретных людей (Лид/сотрудники) —
// исполнителя задачи предлагаем выбрать только из них, а не из всего
// департамента. Никого не отметили — как раньше, весь департамент
// (не ломаем старый простой сценарий "быстро назначил и пошёл дальше").
function assignableEmployeesFor(department: DepartmentOption, selection: DepartmentSelectionState) {
  if (!selection.leadUserId && selection.teamMemberIds.size === 0) {
    return department.employees;
  }
  const allowedIds = new Set(selection.teamMemberIds);
  if (selection.leadUserId) allowedIds.add(selection.leadUserId);
  return department.employees.filter((e) => allowedIds.has(e.id));
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
  const assignableEmployees = assignableEmployeesFor(department, selection);

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
                  items={assignableEmployees.map((e) => ({ value: e.id, label: e.fullName }))}
                >
                  <SelectTrigger type="button" className="w-full">
                    <SelectValue placeholder="Не назначен" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableEmployees.map((employee) => (
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
  "Команда",
  "Задачи",
  "Назначения",
];

export function NewProjectDialog({ employees, departments, currentUserId }: NewProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // По прямой просьбе Камилы: свой департамент(ы) отмечены сразу — не
  // нужно искать его среди всех департаментов компании на шаге 2.
  const defaultSelections = () => {
    if (!currentUserId) return {};
    const initial: Record<string, DepartmentSelectionState> = {};
    for (const department of departments) {
      if (department.managers.some((m) => m.id === currentUserId)) {
        initial[department.id] = { ...emptySelection(currentUserId), checked: true };
      }
    }
    return initial;
  };
  const [selections, setSelections] = useState<Record<string, DepartmentSelectionState>>(defaultSelections);
  // Раньше <Select name="gipUserId"> был неконтролируемым (значение читалось
  // из FormData только при финальном submit) — так кнопка "Назначить себя"
  // не могла программно проставить значение. Base UI Select поддерживает
  // value+name одновременно (скрытый нативный input под капотом всё ещё
  // попадает в FormData), поэтому переводим на контролируемое состояние.
  const [gipUserId, setGipUserId] = useState(NONE_VALUE);
  const formRef = useRef<HTMLFormElement>(null);

  function getSelection(department: DepartmentOption) {
    return selections[department.id] ?? emptySelection(department.managers[0]?.id ?? "");
  }

  function setSelection(departmentId: string, next: DepartmentSelectionState) {
    setSelections((prev) => ({ ...prev, [departmentId]: next }));
  }

  function toggleDepartment(department: DepartmentOption) {
    const current = getSelection(department);
    setSelection(department.id, { ...current, checked: !current.checked });
  }

  function resetAll() {
    setSelections(defaultSelections());
    setGipUserId(NONE_VALUE);
    setStep(1);
  }

  // Форма — один <form> на все 5 шагов (остальные шаги просто скрыты
  // через CSS), а не отдельная форма на шаг — иначе финальный submit не
  // видел бы значения с предыдущих шагов. Обратная сторона: браузер НЕ
  // валидирует required-поля, если их шаг сейчас скрыт (display:none не
  // участвует в constraint validation) — можно было дойти до шага 5,
  // толком не заполнив шаг 1, и узнать об этом только по невнятной
  // ошибке сервера уже на последнем шаге. Поэтому здесь — ручная
  // проверка перед переходом со скрытого шага 1, а не полагаемся на
  // required + нативную валидацию формы.
  function handleNext() {
    if (step === 1) {
      const nameValue = formRef.current?.elements.namedItem("name");
      const isEmpty = nameValue instanceof HTMLInputElement && !nameValue.value.trim();
      if (isEmpty) {
        setError("Название проекта обязательно");
        nameValue?.focus();
        return;
      }
    }
    setError(null);
    setStep((s) => Math.min(5, s + 1));
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

        <form ref={formRef} action={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
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
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="gipUserId">ГИП (необязательно)</Label>
                {currentUserId && gipUserId !== currentUserId ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => setGipUserId(currentUserId)}
                  >
                    Назначить себя
                  </Button>
                ) : null}
              </div>
              <Select
                name="gipUserId"
                value={gipUserId}
                onValueChange={(value) => setGipUserId(value ?? NONE_VALUE)}
                items={[
                  { value: NONE_VALUE, label: "Не назначен" },
                  ...employees.map((employee) => ({ value: employee.id, label: employee.fullName })),
                ]}
              >
                <SelectTrigger type="button" id="gipUserId" className="w-full">
                  <SelectValue placeholder="Не назначен" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Не назначен</SelectItem>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Можно назначить и позже, со страницы проекта.</p>
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

          {/* Шаг 3 — контакт, Лид (если включён) и команда по каждому
              выбранному департаменту (по прямой просьбе Камилы, 2026-07-30):
              выбор Лида и команды необязателен — можно сразу перейти к
              задачам, тогда исполнителя выбирают из всего департамента,
              как раньше. */}
          <div className={cn("space-y-3", step !== 3 && "hidden")}>
            <Label>Команда по департаментам</Label>
            {checkedDepartments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Сначала выберите департаменты на предыдущем шаге.
              </p>
            ) : (
              checkedDepartments.map((department) => {
                const selection = getSelection(department);
                const managerIds = new Set(department.managers.map((m) => m.id));
                const options = [
                  ...department.managers,
                  ...department.employees.filter((e) => !managerIds.has(e.id)),
                ];
                const defaultContactLabel =
                  department.managers.length > 0
                    ? `${department.managers.map((m) => m.fullName).join(", ")} (по умолчанию)`
                    : "Не назначен";

                function toggleTeamMember(employeeId: string) {
                  const next = new Set(selection.teamMemberIds);
                  if (next.has(employeeId)) next.delete(employeeId);
                  else next.add(employeeId);
                  setSelection(department.id, { ...selection, teamMemberIds: next });
                }

                return (
                  <div key={department.id} className="space-y-3 rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="flex size-6 shrink-0 items-center justify-center rounded-md text-white"
                        style={{ backgroundColor: department.color }}
                      >
                        <DepartmentIcon name={department.icon} className="size-3" />
                      </span>
                      <span className="text-sm font-medium">{department.name}</span>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Контактное лицо</Label>
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
                            { value: NONE_VALUE, label: defaultContactLabel },
                            ...options.map((o) => ({ value: o.id, label: o.fullName })),
                          ]}
                        >
                          <SelectTrigger type="button" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE_VALUE}>{defaultContactLabel}</SelectItem>
                            {options.map((o) => (
                              <SelectItem key={o.id} value={o.id}>
                                {o.fullName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    {department.allowsLeadRole ? (
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Лид проекта (необязательно)</Label>
                        <Select
                          value={selection.leadUserId || NONE_VALUE}
                          onValueChange={(value) =>
                            setSelection(department.id, {
                              ...selection,
                              leadUserId: value && value !== NONE_VALUE ? value : "",
                            })
                          }
                          items={[
                            { value: NONE_VALUE, label: "Не назначен" },
                            ...department.employees.map((e) => ({ value: e.id, label: e.fullName })),
                          ]}
                        >
                          <SelectTrigger type="button" className="w-full">
                            <SelectValue placeholder="Не назначен" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE_VALUE}>Не назначен</SelectItem>
                            {department.employees.map((e) => (
                              <SelectItem key={e.id} value={e.id}>
                                {e.fullName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}

                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Команда (необязательно — иначе исполнителя задач можно выбрать из всех
                        сотрудников департамента)
                      </Label>
                      {department.employees.length === 0 ? (
                        <p className="text-xs text-muted-foreground">В департаменте пока нет сотрудников.</p>
                      ) : (
                        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                          {department.employees
                            .filter((e) => e.id !== selection.leadUserId)
                            .map((employee) => (
                              <label
                                key={employee.id}
                                className="flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm"
                              >
                                <Checkbox
                                  checked={selection.teamMemberIds.has(employee.id)}
                                  onCheckedChange={() => toggleTeamMember(employee.id)}
                                />
                                <span className="min-w-0 flex-1 truncate">{employee.fullName}</span>
                              </label>
                            ))}
                        </div>
                      )}
                    </div>
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
              checkedSubItemIds: Array.from(selection.subItemIds),
              customTasks: selection.customTasks,
              contactManagerId: selection.contactManagerId || null,
              leadUserId: selection.leadUserId || null,
              teamMemberIds: Array.from(selection.teamMemberIds),
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
              <Button key="next" type="button" onClick={handleNext}>
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
