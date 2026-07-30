"use client";

import { useOptimistic, useState, useTransition } from "react";

import { leadAssignTaskAction } from "@/lib/leads/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const UNASSIGNED = "__unassigned__";

// Task 5.2/5.4 (PRD #3 Phase 3) — узкий контрол для Лида: назначать
// исполнителя может, но ТОЛЬКО из своих прямых подчинённых
// (assignableMembers уже отфильтрован вызывающим кодом, см.
// app/(dashboard)/projects/[id]/page.tsx). Показывается вместо обычного
// "Не назначена" только когда canManage=false, но у Лида есть хотя бы
// один подчинённый — участник этого проекта.
export function LeadAssigneeControl({
  taskId,
  currentAssigneeMemberId,
  assignableMembers,
}: {
  taskId: string;
  currentAssigneeMemberId: string | null;
  assignableMembers: { id: string; fullName: string }[];
}) {
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [optimisticValue, setOptimisticValue] = useOptimistic(
    currentAssigneeMemberId ?? UNASSIGNED,
  );

  function handleChange(value: string | null) {
    if (!value || value === optimisticValue) return;
    setError(null);
    const nextMemberId = value === UNASSIGNED ? null : value;
    startTransition(async () => {
      setOptimisticValue(value);
      try {
        await leadAssignTaskAction(taskId, nextMemberId);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Не удалось назначить исполнителя");
      }
    });
  }

  return (
    <div className="space-y-1">
      <Select
        value={optimisticValue}
        onValueChange={handleChange}
        items={[
          { value: UNASSIGNED, label: "Не назначен" },
          ...assignableMembers.map((m) => ({ value: m.id, label: m.fullName })),
        ]}
      >
        <SelectTrigger size="sm" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNASSIGNED}>Не назначен</SelectItem>
          {assignableMembers.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.fullName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
