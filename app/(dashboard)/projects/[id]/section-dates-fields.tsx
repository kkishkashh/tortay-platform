"use client";

import { useTransition } from "react";

import { Input } from "@/components/ui/input";
import { updateSectionDatesAction } from "@/lib/projects/actions";

function toDateInputValue(date: Date | null) {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export function SectionDatesFields({
  sectionId,
  startDate,
  deadline,
}: {
  sectionId: string;
  startDate: Date | null;
  deadline: Date | null;
}) {
  const [isPending, startTransition] = useTransition();

  function handleStartDateChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value || null;
    startTransition(() => {
      updateSectionDatesAction(sectionId, value, toDateInputValue(deadline) || null);
    });
  }

  function handleDeadlineChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value || null;
    startTransition(() => {
      updateSectionDatesAction(sectionId, toDateInputValue(startDate) || null, value);
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="date"
        defaultValue={toDateInputValue(startDate)}
        onChange={handleStartDateChange}
        disabled={isPending}
        className="h-8 w-36 text-xs"
        aria-label="Начало раздела"
      />
      <span className="text-xs text-muted-foreground">—</span>
      <Input
        type="date"
        defaultValue={toDateInputValue(deadline)}
        onChange={handleDeadlineChange}
        disabled={isPending}
        className="h-8 w-36 text-xs"
        aria-label="Срок раздела"
      />
    </div>
  );
}
