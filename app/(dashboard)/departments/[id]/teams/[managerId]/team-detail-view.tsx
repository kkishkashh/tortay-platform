"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Crown } from "lucide-react";

import { setEmployeeLeadAction } from "@/lib/leads/actions";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DepartmentHierarchy, DepartmentHierarchyNode } from "@/lib/leads/queries";
import type { UserActiveTask } from "@/lib/tasks/queries";
import { TASK_STATUS_BADGE_VARIANT, TASK_STATUS_LABELS } from "@/lib/projects/status-labels";
import { getAvatarColor, getInitials } from "@/lib/utils";

const REPORTS_TO_NONE = "__none__";

type FlatEmployee = { id: string; fullName: string; position: string | null; reportsToId: string | null };

// Список активных задач сотрудника, каждая — бейджем со своим статусом
// (по прямой просьбе: "список текущих активных задач и статус каждой").
function EmployeeTasks({ tasks }: { tasks: UserActiveTask[] | undefined }) {
  if (!tasks || tasks.length === 0) {
    return <p className="text-xs text-muted-foreground">Нет активных задач</p>;
  }
  return (
    <div className="space-y-1">
      {tasks.map((task) => (
        <div key={task.id} className="flex items-center gap-1.5 text-xs">
          <Badge variant={TASK_STATUS_BADGE_VARIANT[task.status]} className="shrink-0">
            {TASK_STATUS_LABELS[task.status]}
          </Badge>
          <span className="truncate text-muted-foreground">
            {task.title} · {task.projectName}
          </span>
        </div>
      ))}
    </div>
  );
}

function TeamMemberRow({
  employee,
  currentReportsToId,
  managerOptions,
  leadOptions,
  tasks,
  canManage,
  isPending,
  onChange,
}: {
  employee: DepartmentHierarchyNode;
  currentReportsToId: string | null;
  managerOptions: DepartmentHierarchyNode[];
  leadOptions: DepartmentHierarchyNode[];
  tasks: UserActiveTask[] | undefined;
  canManage: boolean;
  isPending: boolean;
  onChange: (employeeId: string, targetId: string | null) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
          style={{ backgroundColor: getAvatarColor(employee.id) }}
        >
          {getInitials(employee.fullName)}
        </span>
        <div className="min-w-0">
          <Link href={`/employees/${employee.id}`} className="truncate text-sm font-medium hover:underline">
            {employee.fullName}
          </Link>
          <div className="mt-1">
            <EmployeeTasks tasks={tasks} />
          </div>
        </div>
      </div>
      {canManage ? (
        <Select
          value={currentReportsToId ?? REPORTS_TO_NONE}
          items={[
            { value: REPORTS_TO_NONE, label: "Не назначен" },
            ...managerOptions.map((m) => ({ value: m.id, label: `${m.fullName} (руководитель)` })),
            ...leadOptions.map((l) => ({ value: l.id, label: l.fullName })),
          ]}
          onValueChange={(value) => onChange(employee.id, value === REPORTS_TO_NONE ? null : value)}
          disabled={isPending}
        >
          <SelectTrigger size="sm" className="w-56 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={REPORTS_TO_NONE}>Не назначен</SelectItem>
            {managerOptions.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.fullName} (руководитель)
              </SelectItem>
            ))}
            {leadOptions.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  );
}

export function TeamDetailView({
  departmentId,
  hierarchy,
  managerId,
  employees,
  tasksByUserId,
  canManage,
}: {
  departmentId: string;
  hierarchy: DepartmentHierarchy;
  managerId: string;
  employees: FlatEmployee[];
  tasksByUserId: Map<string, UserActiveTask[]>;
  canManage: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const manager = hierarchy.managers.find((m) => m.id === managerId);

  function handleChange(employeeId: string, targetId: string | null) {
    startTransition(() => {
      setEmployeeLeadAction(employeeId, targetId).catch((error) => {
        alert(error instanceof Error ? error.message : "Не удалось изменить назначение");
      });
    });
  }

  if (!manager) {
    return (
      <p className="text-sm text-muted-foreground">
        Этот руководитель больше не ведёт департамент — вернитесь на{" "}
        <Link href={`/departments/${departmentId}`} className="underline">
          страницу департамента
        </Link>
        .
      </p>
    );
  }

  const managerIds = new Set(hierarchy.managers.map((m) => m.id));
  const managerOptionsBase: DepartmentHierarchyNode[] = hierarchy.managers.map((m) => ({
    id: m.id,
    fullName: m.fullName,
    position: m.position,
  }));
  const leadOptionsBase: DepartmentHierarchyNode[] = employees
    .filter((e) => e.reportsToId !== null && managerIds.has(e.reportsToId))
    .map((e) => ({ id: e.id, fullName: e.fullName, position: e.position }));

  function optionsFor(employeeId: string) {
    return {
      managerOptions: managerOptionsBase.filter((m) => m.id !== employeeId),
      leadOptions: leadOptionsBase.filter((l) => l.id !== employeeId),
    };
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/departments/${departmentId}`}
        className="text-sm text-muted-foreground hover:underline"
      >
        ← Назад к департаменту
      </Link>

      {manager.leads.length === 0 && manager.directReports.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          У этого руководителя пока никого не закреплено — назначьте на вкладке «Структура», выбрав
          {" "}
          {manager.fullName} в списке «Ещё не распределены».
        </p>
      ) : null}

      {manager.leads.map((lead) => {
        const { managerOptions } = optionsFor(lead.id);
        return (
          <div key={lead.id} className="space-y-3 rounded-xl border bg-card p-4 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: getAvatarColor(lead.id) }}
                >
                  {getInitials(lead.fullName)}
                </span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium">{lead.fullName}</p>
                    <Badge variant="outline" className="gap-1">
                      <Crown className="size-3" />
                      Лид
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">в команде: {lead.reports.length}</p>
                </div>
              </div>
              {canManage ? (
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">Подчиняется:</p>
                  <Select
                    value={managerId}
                    items={managerOptionsBase.map((m) => ({ value: m.id, label: m.fullName }))}
                    onValueChange={(value) => {
                      if (value && value !== managerId) handleChange(lead.id, value);
                    }}
                    disabled={isPending}
                  >
                    <SelectTrigger size="sm" className="w-56">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {managerOptionsBase.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>

            <div className="space-y-2 border-t pt-3">
              {lead.reports.length === 0 ? (
                <p className="text-xs text-muted-foreground">В команде пока никого нет.</p>
              ) : (
                lead.reports.map((report) => (
                  <TeamMemberRow
                    key={report.id}
                    employee={report}
                    currentReportsToId={lead.id}
                    managerOptions={managerOptionsBase.filter((m) => m.id !== report.id)}
                    leadOptions={leadOptionsBase.filter((l) => l.id !== report.id)}
                    tasks={tasksByUserId.get(report.id)}
                    canManage={canManage}
                    isPending={isPending}
                    onChange={handleChange}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}

      {manager.directReports.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Без Лида — напрямую у {manager.fullName.split(" ")[0]}
          </p>
          <div className="space-y-2">
            {manager.directReports.map((employee) => {
              const { managerOptions, leadOptions } = optionsFor(employee.id);
              return (
                <TeamMemberRow
                  key={employee.id}
                  employee={employee}
                  currentReportsToId={managerId}
                  managerOptions={managerOptions}
                  leadOptions={leadOptions}
                  tasks={tasksByUserId.get(employee.id)}
                  canManage={canManage}
                  isPending={isPending}
                  onChange={handleChange}
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
