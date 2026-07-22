"use client";

import { useTransition } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { toggleTaskChecklistItemAction } from "@/lib/tasks/actions";
import { cn } from "@/lib/utils";

export type TaskChecklistItemView = { id: string; title: string; isDone: boolean };

// Лёгкий чек-лист внутри карточки задачи (см. план "Task checklist
// sub-items") — заполняется из подпунктов пункта базового стека при
// создании проекта. Переключать может только исполнитель/руководитель
// (canToggle уже вычислен вызывающей стороной, та же аудитория, что и у
// остальных элементов управления статусом на карточке).
export function TaskChecklist({
  items,
  canToggle,
}: {
  items: TaskChecklistItemView[];
  canToggle: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  if (items.length === 0) return null;

  const doneCount = items.filter((item) => item.isDone).length;

  function handleToggle(itemId: string, next: boolean) {
    startTransition(async () => {
      await toggleTaskChecklistItemAction(itemId, next);
    });
  }

  return (
    <div className="space-y-1.5 rounded-lg border p-2.5">
      <p className="text-[11px] font-medium text-muted-foreground">
        Чек-лист: {doneCount}/{items.length}
      </p>
      <div className="space-y-1">
        {items.map((item) => (
          <label
            key={item.id}
            className={cn("flex items-center gap-2 text-xs", canToggle ? "cursor-pointer" : "cursor-default")}
          >
            <Checkbox
              checked={item.isDone}
              disabled={!canToggle || isPending}
              onCheckedChange={(checked) => handleToggle(item.id, checked === true)}
            />
            <span className={cn(item.isDone && "text-muted-foreground line-through")}>{item.title}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
