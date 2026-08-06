"use client";

import { useTransition } from "react";
import { SectionStatus } from "@prisma/client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateSectionStatusAction } from "@/lib/projects/actions";
import { SECTION_STATUS_LABELS } from "@/lib/projects/status-labels";

const STATUS_OPTIONS = [SectionStatus.В_РАБОТЕ, SectionStatus.ВЫПОЛНЕНО];

export function SectionStatusSelect({
  sectionId,
  status,
}: {
  sectionId: string;
  status: SectionStatus;
}) {
  const [isPending, startTransition] = useTransition();

  function handleValueChange(value: string | null) {
    if (!value) return;
    startTransition(() => {
      updateSectionStatusAction(sectionId, value as SectionStatus).catch((error) => {
        alert(error instanceof Error ? error.message : "Не удалось изменить статус раздела");
      });
    });
  }

  return (
    <Select
      value={status}
      onValueChange={handleValueChange}
      disabled={isPending}
      items={STATUS_OPTIONS.map((option) => ({
        value: option,
        label: SECTION_STATUS_LABELS[option],
      }))}
    >
      <SelectTrigger size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((option) => (
          <SelectItem key={option} value={option}>
            {SECTION_STATUS_LABELS[option]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
