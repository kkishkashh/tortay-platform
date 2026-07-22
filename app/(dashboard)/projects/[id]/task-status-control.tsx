"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { TaskStatus } from "@prisma/client";

import { updateTaskStatusAction } from "@/lib/tasks/actions";
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

// Исполнитель: тот же наглядный степпер из 4 этапов, но теперь кликабелен
// ЛЮБОЙ этап (не только следующий) — по просьбе пользователя сотрудник
// должен уметь сам вернуть свою задачу назад (например, с "Выполнено" на
// "На проверке"), а не только двигать её вперёд. Полная свобода направления,
// как у руководителя (см. updateTaskStatusAction — тот же экшен, что и у
// ManagerTaskStatusControl, просто в другом визуальном оформлении).
// Оптимистичное обновление — степпер сразу переходит на выбранный этап по
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
  const currentIndex = ALL_STATUSES.indexOf(optimisticStatus);

  function handleSelect(step: TaskStatus) {
    if (step === optimisticStatus) return;
    setError(null);
    startTransition(async () => {
      setOptimisticStatus(step);
      try {
        await updateTaskStatusAction(taskId, step);
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
          const isLastStep = index === ALL_STATUSES.length - 1;

          return (
            <div key={step} className="flex flex-1 items-center last:flex-none">
              <button
                type="button"
                disabled={isCurrent}
                onClick={() => handleSelect(step)}
                title={isCurrent ? TASK_STATUS_LABELS[step] : `Отметить: «${TASK_STATUS_LABELS[step]}»`}
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-semibold transition-colors",
                  isDone && "cursor-pointer border-green-600 bg-green-600 text-white hover:opacity-80",
                  isCurrent && "border-primary bg-primary text-primary-foreground",
                  !isDone && !isCurrent && "cursor-pointer border-primary/50 bg-background text-primary hover:bg-primary/10",
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
