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

// Task 5.2/5.4 (PRD #3 Phase 3) — узкий контрол для Ведущего архитектора:
// назначать исполнителя может (2026-08-06, по прямой просьбе — из ВСЕХ
// сотрудников платформы, не только своей команды, как было раньше).
// Показывается вместо обычного "Не назначена" только когда canManage=false,
// но у зрителя есть хотя бы один подчинённый (т.е. он вообще Ведущий
// архитектор — см. app/(dashboard)/projects/[id]/page.tsx).
export function LeadAssigneeControl({
  taskId,
  currentAssigneeUserId,
  assignableEmployees,
}: {
  taskId: string;
  currentAssigneeUserId: string | null;
  assignableEmployees: { id: string; fullName: string }[];
}) {
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [optimisticValue, setOptimisticValue] = useOptimistic(
    currentAssigneeUserId ?? UNASSIGNED,
  );

  function handleChange(value: string | null) {
    if (!value || value === optimisticValue) return;
    setError(null);
    const nextUserId = value === UNASSIGNED ? null : value;
    startTransition(async () => {
      setOptimisticValue(value);
      try {
        await leadAssignTaskAction(taskId, nextUserId);
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
          ...assignableEmployees.map((m) => ({ value: m.id, label: m.fullName })),
        ]}
      >
        <SelectTrigger size="sm" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNASSIGNED}>Не назначен</SelectItem>
          {assignableEmployees.map((m) => (
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
