"use client";

import { ReactNode, useState, useTransition } from "react";
import { ArrowLeft } from "lucide-react";
import { TaskPriority, TaskStackCategory } from "@prisma/client";

import { createTaskAction, updateTaskAction } from "@/lib/tasks/actions";
import type { DepartmentTaskStackItem } from "@/lib/departments/queries";
import { Button } from "@/components/ui/button";
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

const STACK_CATEGORY_LABELS: Record<TaskStackCategory, string> = {
  [TaskStackCategory.БАЗОВЫЙ]: "Базовый стек",
  [TaskStackCategory.НЕСТАНДАРТНЫЙ]: "Нестандартный стек",
};

// Первый экран диалога создания задачи (только когда у департамента этого
// раздела вообще есть стек, см. TaskDialog ниже) — выбор готового пункта
// стека ИЛИ переход к обычной форме для произвольной задачи. Список не
// прячет уже использованные пункты (по прямой просьбе — один и тот же
// пункт стека может понадобиться в разделе повторно).
function StackPicker({
  taskStack,
  onSelect,
  onCustom,
}: {
  taskStack: DepartmentTaskStackItem[];
  onSelect: (item: DepartmentTaskStackItem) => void;
  onCustom: () => void;
}) {
  const categories = [TaskStackCategory.БАЗОВЫЙ, TaskStackCategory.НЕСТАНДАРТНЫЙ];

  return (
    <div className="space-y-4">
      {categories.map((category) => {
        const items = taskStack.filter((item) => item.category === category);
        if (items.length === 0) return null;
        return (
          <div key={category} className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              {STACK_CATEGORY_LABELS[category]}
            </p>
            <div className="space-y-1.5">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item)}
                  className="w-full rounded-lg border p-3 text-left text-sm hover:bg-muted"
                >
                  <p className="font-medium">{item.title}</p>
                  {item.description ? (
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  ) : null}
                  {item.subItems.length > 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Чек-лист: {item.subItems.map((sub) => sub.title).join(", ")}
                    </p>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <Button type="button" variant="outline" className="w-full" onClick={onCustom}>
        Своя задача
      </Button>
    </div>
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
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Показываем выбор из стека только в режиме создания и только если у
  // департамента раздела вообще есть готовые пункты — иначе сразу форма,
  // как и было раньше (легаси-разделы без департамента, см. D4).
  const hasStack = mode === "create" && taskStack.length > 0;
  const [stage, setStage] = useState<"picker" | "form">(hasStack ? "picker" : "form");
  const [selectedItem, setSelectedItem] = useState<DepartmentTaskStackItem | null>(null);

  function resetToPicker() {
    setSelectedItem(null);
    setStage(hasStack ? "picker" : "form");
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      resetToPicker();
      setError(null);
    }
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        if (mode === "create") {
          await createTaskAction(sectionId, formData);
        } else {
          await updateTaskAction(taskId, formData);
        }
        setOpen(false);
        resetToPicker();
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "Не удалось сохранить задачу",
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {stage === "picker"
              ? "Новая задача — выберите из стека"
              : mode === "create"
                ? "Новая задача"
                : "Редактировать задачу"}
          </DialogTitle>
        </DialogHeader>

        {stage === "picker" ? (
          <StackPicker
            taskStack={taskStack}
            onSelect={(item) => {
              setSelectedItem(item);
              setStage("form");
            }}
            onCustom={() => {
              setSelectedItem(null);
              setStage("form");
            }}
          />
        ) : (
        <form action={handleSubmit} className="space-y-4">
          {selectedItem ? (
            <input type="hidden" name="taskTemplateItemId" value={selectedItem.id} />
          ) : null}

          {hasStack ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-2 h-7 px-2 text-xs"
              onClick={resetToPicker}
            >
              <ArrowLeft className="size-3.5" />
              К стеку задач
            </Button>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="title">Название</Label>
            <Input
              id="title"
              name="title"
              defaultValue={selectedItem?.title ?? defaults?.title}
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Описание (необязательно)</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={selectedItem?.description ?? defaults?.description ?? undefined}
              rows={3}
            />
          </div>

          {selectedItem && selectedItem.subItems.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              В задачу автоматически добавится чек-лист: {selectedItem.subItems.map((sub) => sub.title).join(", ")}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Приоритет</Label>
              <Select
                name="priority"
                defaultValue={defaults?.priority ?? TaskPriority.СРЕДНИЙ}
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
                defaultValue={toDateInputValue(defaults?.deadline ?? null)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assigneeMemberId">Исполнитель</Label>
            <Select
              name="assigneeMemberId"
              defaultValue={defaults?.assigneeMemberId ?? UNASSIGNED}
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
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
              Отмена
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Сохраняем…" : mode === "create" ? "Создать" : "Сохранить"}
            </Button>
          </div>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
