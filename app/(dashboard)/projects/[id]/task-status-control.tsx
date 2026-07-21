"use client";

import { useState, useTransition } from "react";
import { ArrowRight } from "lucide-react";
import { TaskStatus } from "@prisma/client";

import { advanceTaskStatusAction, updateTaskStatusAction } from "@/lib/tasks/actions";
import { FORWARD_TRANSITIONS } from "@/lib/tasks/permissions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TASK_STATUS_LABELS } from "@/lib/projects/status-labels";

const ALL_STATUSES = [
  TaskStatus.НОВАЯ,
  TaskStatus.В_РАБОТЕ,
  TaskStatus.НА_ПРОВЕРКЕ,
  TaskStatus.ВЫПОЛНЕНО,
];

// Менеджер/администратор: полный Select, статус можно двигать в любую
// сторону (в т.ч. назад — "вернуть на доработку").
export function ManagerTaskStatusControl({
  taskId,
  status,
}: {
  taskId: string;
  status: TaskStatus;
}) {
  const [isPending, startTransition] = useTransition();

  function handleValueChange(value: string | null) {
    if (!value || value === status) return;
    startTransition(() => {
      updateTaskStatusAction(taskId, value as TaskStatus);
    });
  }

  return (
    <Select
      value={status}
      onValueChange={handleValueChange}
      disabled={isPending}
      items={ALL_STATUSES.map((option) => ({ value: option, label: TASK_STATUS_LABELS[option] }))}
    >
      <SelectTrigger size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ALL_STATUSES.map((option) => (
          <SelectItem key={option} value={option}>
            {TASK_STATUS_LABELS[option]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Исполнитель: только кнопка "Далее" — двигает статус на один шаг вперёд
// по фиксированному циклу. Никакого выпадающего списка не показываем
// вообще, чтобы даже в интерфейсе не было возможности "перепрыгнуть"
// через этап (сервер всё равно перепроверяет это в advanceTaskStatusAction).
export function AssigneeTaskStatusControl({
  taskId,
  status,
}: {
  taskId: string;
  status: TaskStatus;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const nextStatus = FORWARD_TRANSITIONS[status];

  if (!nextStatus) {
    return null;
  }

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        await advanceTaskStatusAction(taskId, nextStatus!);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Не удалось изменить статус");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" size="sm" variant="outline" onClick={handleClick} disabled={isPending}>
        {isPending ? "Обновляем…" : TASK_STATUS_LABELS[nextStatus]}
        <ArrowRight className="size-3.5" />
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
