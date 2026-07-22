"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { TaskStatus } from "@prisma/client";

import { advanceTaskStatusAction, updateTaskStatusAction } from "@/lib/tasks/actions";
import { FORWARD_TRANSITIONS } from "@/lib/tasks/permissions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TASK_STATUS_LABELS } from "@/lib/projects/status-labels";
import { cn } from "@/lib/utils";

const ALL_STATUSES = [
  TaskStatus.НОВАЯ,
  TaskStatus.В_РАБОТЕ,
  TaskStatus.НА_ПРОВЕРКЕ,
  TaskStatus.ВЫПОЛНЕНО,
];

// Менеджер/администратор: полный Select, статус можно двигать в любую
// сторону (в т.ч. назад — "вернуть на доработку"). Оптимистичное
// обновление (useOptimistic) — Select переключается сразу по клику, не
// дожидаясь полного круга server action → revalidatePath → ре-рендер (см.
// тот же приём и причину в components/dashboard/task-checklist.tsx).
export function ManagerTaskStatusControl({
  taskId,
  status,
}: {
  taskId: string;
  status: TaskStatus;
}) {
  const [, startTransition] = useTransition();
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(status);

  function handleValueChange(value: string | null) {
    if (!value || value === optimisticStatus) return;
    const nextStatus = value as TaskStatus;
    startTransition(async () => {
      setOptimisticStatus(nextStatus);
      await updateTaskStatusAction(taskId, nextStatus);
    });
  }

  return (
    <Select
      value={optimisticStatus}
      onValueChange={handleValueChange}
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

// Исполнитель: наглядный степпер из 4 этапов вместо одной кнопки с текстом —
// сразу видно, на каком этапе задача сейчас (см. план "понятный интерфейс
// для сотрудника"). Кликабелен только СЛЕДУЮЩИЙ этап (двигает статус на один
// шаг вперёд по фиксированному циклу, как галочка "отметил — перешли
// дальше") — прошлые и будущие этапы не кликабельны, никакого выпадающего
// списка, чтобы даже в интерфейсе не было возможности "перепрыгнуть" через
// этап (сервер всё равно перепроверяет это в advanceTaskStatusAction).
// Оптимистичное обновление — степпер сразу переходит на следующий этап по
// клику, не дожидаясь полного круга server action → revalidatePath →
// ре-рендер (см. тот же приём в components/dashboard/task-checklist.tsx).
export function AssigneeTaskStatusControl({
  taskId,
  status,
}: {
  taskId: string;
  status: TaskStatus;
}) {
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(status);
  const nextStatus = FORWARD_TRANSITIONS[optimisticStatus];
  const currentIndex = ALL_STATUSES.indexOf(optimisticStatus);

  function handleAdvance() {
    if (!nextStatus) return;
    setError(null);
    startTransition(async () => {
      setOptimisticStatus(nextStatus);
      try {
        await advanceTaskStatusAction(taskId, nextStatus);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Не удалось изменить статус");
      }
    });
  }

  return (
    <div className="w-full space-y-1.5">
      <div className="flex items-center">
        {ALL_STATUSES.map((step, index) => {
          const isDone = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isNext = nextStatus !== null && step === nextStatus;
          const isLastStep = index === ALL_STATUSES.length - 1;

          return (
            <div key={step} className="flex flex-1 items-center last:flex-none">
              <button
                type="button"
                disabled={!isNext}
                onClick={isNext ? handleAdvance : undefined}
                title={isNext ? `Отметить выполненным этап «${TASK_STATUS_LABELS[step]}»` : TASK_STATUS_LABELS[step]}
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-semibold transition-colors",
                  isDone && "border-green-600 bg-green-600 text-white",
                  isCurrent && "border-primary bg-primary text-primary-foreground",
                  isNext && "cursor-pointer border-primary/50 bg-background text-primary hover:bg-primary/10",
                  !isDone && !isCurrent && !isNext && "cursor-default border-muted bg-background text-muted-foreground",
                )}
              >
                {isDone ? <Check className="size-3.5" /> : index + 1}
              </button>
              {!isLastStep ? (
                <div className={cn("h-0.5 flex-1", isDone ? "bg-green-600" : "bg-muted")} />
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="flex text-[10px] text-muted-foreground">
        {ALL_STATUSES.map((step) => (
          <span key={step} className="flex-1 text-center first:text-left last:text-right">
            {TASK_STATUS_LABELS[step]}
          </span>
        ))}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
