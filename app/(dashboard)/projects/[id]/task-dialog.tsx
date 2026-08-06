"use client";

import { ReactNode, useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { TaskPriority, TaskStackCategory } from "@prisma/client";

import { createTasksFromStackAction, updateTaskAction } from "@/lib/tasks/actions";
import type { DepartmentTaskStackItem } from "@/lib/departments/queries";
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
import { TASK_PRIORITY_LABELS } from "@/lib/projects/status-labels";
import { UNASSIGNED_MEMBER_VALUE } from "@/lib/tasks/constants";
import { cn } from "@/lib/utils";

const PRIORITY_OPTIONS = [
  TaskPriority.НИЗКИЙ,
  TaskPriority.СРЕДНИЙ,
  TaskPriority.ВЫСОКИЙ,
  TaskPriority.СРОЧНЫЙ,
];

const UNASSIGNED = UNASSIGNED_MEMBER_VALUE;

type ProjectMemberOption = { id: string; fullName: string };

type TaskDefaults = {
  title: string;
  description: string | null;
  priority: TaskPriority;
  deadline: Date | null;
  assigneeMemberId: string | null;
};

function toDateInputValue(date: Date | null) {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

// Своя задача, добавленная кнопкой "+ своя задача" — идентифицируется
// стабильным клиентским ключом, не индексом (тот же приём, что и в мастере
// создания проекта, см. new-project-dialog.tsx::CustomTask).
type CustomTask = { key: string; title: string };

// Тот же формат, что и шаг "Задачи" мастера создания проекта (см.
// new-project-dialog.tsx::StepDepartmentTaskPicker) — по прямой просьбе,
// "один в один": чекбоксы позволяют отметить сразу несколько пунктов
// стека, плюс свои задачи, и всё создаётся одним действием ниже.
function TaskStackPicker({
  taskStack,
  itemIds,
  subItemIds,
  onToggleItem,
  onToggleSubItem,
}: {
  taskStack: DepartmentTaskStackItem[];
  itemIds: Set<string>;
  subItemIds: Set<string>;
  onToggleItem: (item: DepartmentTaskStackItem) => void;
  onToggleSubItem: (subItemId: string) => void;
}) {
  const [showNonStandard, setShowNonStandard] = useState(false);

  const baseItems = taskStack.filter((item) => item.category === TaskStackCategory.БАЗОВЫЙ);
  const nonStandardItems = taskStack.filter(
    (item) => item.category === TaskStackCategory.НЕСТАНДАРТНЫЙ,
  );

  function renderItemRow(item: DepartmentTaskStackItem) {
    return (
      <div key={item.id}>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={itemIds.has(item.id)} onCheckedChange={() => onToggleItem(item)} />
          {item.title}
        </label>
        {itemIds.has(item.id) && item.subItems.length > 0 ? (
          <div className="mt-1 ml-6 space-y-1 border-l pl-3">
            {item.subItems.map((sub) => (
              <label key={sub.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={subItemIds.has(sub.id)}
                  onCheckedChange={() => onToggleSubItem(sub.id)}
                />
                {sub.title}
              </label>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {baseItems.length === 0 ? (
        <p className="text-xs text-muted-foreground">В базовом стеке этого департамента пока нет задач.</p>
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
    </div>
  );
}

// Режим создания — можно отметить сразу несколько пунктов стека и/или
// добавить свои задачи, задать общий срок/приоритет/исполнителя и создать
// всё одним нажатием (см. createTasksFromStackAction).
function CreateTasksForm({
  sectionId,
  projectMembers,
  taskStack,
  onDone,
}: {
  sectionId: string;
  projectMembers: ProjectMemberOption[];
  taskStack: DepartmentTaskStackItem[];
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [itemIds, setItemIds] = useState<Set<string>>(new Set());
  const [subItemIds, setSubItemIds] = useState<Set<string>>(new Set());
  const [customTasks, setCustomTasks] = useState<CustomTask[]>([]);
  const [customDraft, setCustomDraft] = useState("");

  const selectedCount = itemIds.size + customTasks.length;

  // Отметить пункт — заодно по умолчанию отмечает ВСЕ его подпункты (чек-лист
  // войдёт в задачу целиком, как и в мастере создания проекта); снять пункт —
  // снимает и подпункты. Конкретные подпункты можно донастроить отдельно.
  function toggleItem(item: DepartmentTaskStackItem) {
    setItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      return next;
    });
    setSubItemIds((prev) => {
      const next = new Set(prev);
      for (const sub of item.subItems) {
        if (itemIds.has(item.id)) {
          next.delete(sub.id);
        } else {
          next.add(sub.id);
        }
      }
      return next;
    });
  }

  function toggleSubItem(subItemId: string) {
    setSubItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(subItemId)) {
        next.delete(subItemId);
      } else {
        next.add(subItemId);
      }
      return next;
    });
  }

  function addCustomTask() {
    const title = customDraft.trim();
    if (!title) return;
    setCustomTasks((prev) => [...prev, { key: `custom:${crypto.randomUUID()}`, title }]);
    setCustomDraft("");
  }

  function removeCustomTask(key: string) {
    setCustomTasks((prev) => prev.filter((t) => t.key !== key));
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    if (selectedCount === 0) {
      setError("Выберите хотя бы одну задачу");
      return;
    }
    for (const id of itemIds) formData.append("templateItemId", id);
    for (const id of subItemIds) formData.append("subItemId", id);
    for (const task of customTasks) formData.append("customTaskTitle", task.title);

    startTransition(async () => {
      try {
        await createTasksFromStackAction(sectionId, formData);
        onDone();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Не удалось создать задачи");
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      {taskStack.length > 0 ? (
        <TaskStackPicker
          taskStack={taskStack}
          itemIds={itemIds}
          subItemIds={subItemIds}
          onToggleItem={toggleItem}
          onToggleSubItem={toggleSubItem}
        />
      ) : null}

      {customTasks.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {customTasks.map((task) => (
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
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex gap-2">
        <Input
          value={customDraft}
          onChange={(event) => setCustomDraft(event.target.value)}
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

      <div className="grid grid-cols-2 gap-4 border-t pt-4">
        <div className="space-y-2">
          <Label htmlFor="priority">Приоритет</Label>
          <Select
            name="priority"
            defaultValue={TaskPriority.СРЕДНИЙ}
            items={PRIORITY_OPTIONS.map((p) => ({ value: p, label: TASK_PRIORITY_LABELS[p] }))}
          >
            <SelectTrigger id="priority" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((p) => (
                <SelectItem key={p} value={p}>
                  {TASK_PRIORITY_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="deadline">Срок</Label>
          <Input id="deadline" name="deadline" type="date" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="assigneeMemberId">Исполнитель</Label>
        <Select
          name="assigneeMemberId"
          defaultValue={UNASSIGNED}
          items={[
            { value: UNASSIGNED, label: "Не назначен" },
            ...projectMembers.map((m) => ({ value: m.id, label: m.fullName })),
          ]}
        >
          <SelectTrigger id="assigneeMemberId" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNASSIGNED}>Не назначен</SelectItem>
            {projectMembers.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone} disabled={isPending}>
          Отмена
        </Button>
        <Button type="submit" disabled={isPending || selectedCount === 0}>
          {isPending ? "Создаём…" : `Создать выбранные (${selectedCount})`}
        </Button>
      </div>
    </form>
  );
}

function EditTaskForm({
  taskId,
  projectMembers,
  defaults,
  onDone,
}: {
  taskId: string;
  projectMembers: ProjectMemberOption[];
  defaults: TaskDefaults;
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await updateTaskAction(taskId, formData);
        onDone();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Не удалось сохранить задачу");
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Название</Label>
        <Input id="title" name="title" defaultValue={defaults.title} required autoFocus />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Описание (необязательно)</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={defaults.description ?? undefined}
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="priority">Приоритет</Label>
          <Select
            name="priority"
            defaultValue={defaults.priority}
            items={PRIORITY_OPTIONS.map((p) => ({ value: p, label: TASK_PRIORITY_LABELS[p] }))}
          >
            <SelectTrigger id="priority" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((p) => (
                <SelectItem key={p} value={p}>
                  {TASK_PRIORITY_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="deadline">Срок</Label>
          <Input
            id="deadline"
            name="deadline"
            type="date"
            defaultValue={toDateInputValue(defaults.deadline)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="assigneeMemberId">Исполнитель</Label>
        <Select
          name="assigneeMemberId"
          defaultValue={defaults.assigneeMemberId ?? UNASSIGNED}
          items={[
            { value: UNASSIGNED, label: "Не назначен" },
            ...projectMembers.map((m) => ({ value: m.id, label: m.fullName })),
          ]}
        >
          <SelectTrigger id="assigneeMemberId" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNASSIGNED}>Не назначен</SelectItem>
            {projectMembers.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone} disabled={isPending}>
          Отмена
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Сохраняем…" : "Сохранить"}
        </Button>
      </div>
    </form>
  );
}

export function TaskDialog({
  trigger,
  projectMembers,
  mode,
  sectionId,
  taskId,
  defaults,
  taskStack = [],
}: {
  trigger: ReactNode;
  projectMembers: ProjectMemberOption[];
} & (
  | { mode: "create"; sectionId: string; taskId?: undefined; defaults?: undefined; taskStack?: DepartmentTaskStackItem[] }
  | { mode: "edit"; taskId: string; sectionId?: undefined; defaults: TaskDefaults; taskStack?: undefined }
)) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Новые задачи" : "Редактировать задачу"}</DialogTitle>
        </DialogHeader>
        {mode === "create" ? (
          <CreateTasksForm
            sectionId={sectionId}
            projectMembers={projectMembers}
            taskStack={taskStack}
            onDone={() => setOpen(false)}
          />
        ) : (
          <EditTaskForm
            taskId={taskId}
            projectMembers={projectMembers}
            defaults={defaults}
            onDone={() => setOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
