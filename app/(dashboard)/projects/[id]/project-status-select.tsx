"use client";

import { useTransition } from "react";
import { ProjectStatus } from "@prisma/client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateProjectStatusAction } from "@/lib/projects/actions";
import { PROJECT_STATUS_LABELS } from "@/lib/projects/status-labels";

const STATUS_OPTIONS = [
  ProjectStatus.В_РАБОТЕ,
  ProjectStatus.ЗАВЕРШЁН_ПО_РАЗДЕЛАМ,
  ProjectStatus.ЗАВЕРШЁН_ПОЛНОСТЬЮ,
];

export function ProjectStatusSelect({
  projectId,
  status,
}: {
  projectId: string;
  status: ProjectStatus;
}) {
  const [isPending, startTransition] = useTransition();

  function handleValueChange(value: string | null) {
    if (!value) return;
    startTransition(() => {
      updateProjectStatusAction(projectId, value as ProjectStatus).catch((error) => {
        alert(error instanceof Error ? error.message : "Не удалось изменить статус проекта");
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
        label: PROJECT_STATUS_LABELS[option],
      }))}
    >
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((option) => (
          <SelectItem key={option} value={option}>
            {PROJECT_STATUS_LABELS[option]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
