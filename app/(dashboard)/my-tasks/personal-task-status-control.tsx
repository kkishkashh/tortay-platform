"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { TaskStatus } from "@prisma/client";

import { updatePersonalTaskStatusAction } from "@/lib/personal-tasks/actions";
import { TASK_STATUS_LABELS } from "@/lib/projects/status-labels";
import { cn } from "@/lib/utils";

// Три стадии, без "На проверке" — личную задачу некому проверять (см.
// lib/personal-tasks/actions.ts). Тот же наглядный степпер, что и у рабочих
// задач исполнителя (см. AssigneeTaskStatusControl) — кликабелен любой
// этап, оптимистичное обновление.
const STAGES: TaskStatus[] = [TaskStatus.НОВАЯ, TaskStatus.В_РАБОТЕ, TaskStatus.ВЫПОЛНЕНО];

export function PersonalTaskStatusControl({
  taskId,
  status,
}: {
  taskId: string;
  status: TaskStatus;
}) {
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(status);
  const currentIndex = STAGES.indexOf(optimisticStatus);

  function handleSelect(step: TaskStatus) {
    if (step === optimisticStatus) return;
    setError(null);
    startTransition(async () => {
      setOptimisticStatus(step);
      try {
        await updatePersonalTaskStatusAction(taskId, step);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Не удалось изменить статус");
      }
    });
  }

  return (
    <div className="w-full space-y-1.5">
      <div className="flex items-center">
        {STAGES.map((step, index) => {
          const isDone = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isLastStep = index === STAGES.length - 1;

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
        {STAGES.map((step) => (
          <span key={step} className="flex-1 text-center first:text-left last:text-right">
            {TASK_STATUS_LABELS[step]}
          </span>
        ))}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
