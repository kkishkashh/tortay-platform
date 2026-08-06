"use client";

import { useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { setEmployeeLeadAction } from "@/lib/leads/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TeamCard, getTeamCardColor } from "@/components/departments/team-card";
import type { DepartmentHierarchy, DepartmentHierarchyNode } from "@/lib/leads/queries";
import type { UserTaskWorkload } from "@/lib/tasks/queries";
import { WORKLOAD_META } from "@/lib/workload";
import { getAvatarColor, getInitials } from "@/lib/utils";

const REPORTS_TO_NONE = "__none__";

// Компактный индикатор "на каком этапе сейчас" — без похода на профиль
// сотрудника за полным списком задач: цвет + текущая задача, если есть.
function WorkloadBadge({ workload }: { workload: UserTaskWorkload | undefined }) {
  if (!workload || workload.activeCount === 0) {
    return <span className="text-xs text-muted-foreground">Нет активных задач</span>;
  }
  const meta = WORKLOAD_META[workload.workload];
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-xs">
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
      <span className="shrink-0 text-muted-foreground">{meta.label}</span>
      {workload.currentTask ? (
        <span className="truncate text-muted-foreground">· {workload.currentTask.title}</span>
      ) : null}
      {workload.lateCount > 0 ? (
        <span className="flex shrink-0 items-center gap-0.5 text-destructive">
          <AlertTriangle className="size-3" />
          {workload.lateCount}
        </span>
      ) : null}
    </div>
  );
}

function EmployeeRow({
  employee,
  currentReportsToId,
  managerOptions,
  leadOptions,
  workload,
  canManage,
  isPending,
  onChange,
}: {
  employee: DepartmentHierarchyNode;
  currentReportsToId: string | null;
  managerOptions: DepartmentHierarchyNode[];
  leadOptions: DepartmentHierarchyNode[];
  workload: UserTaskWorkload | undefined;
  canManage: boolean;
  isPending: boolean;
  onChange: (employeeId: string, targetId: string | null) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
          style={{ backgroundColor: getAvatarColor(employee.id) }}
        >
          {getInitials(employee.fullName)}
        </span>
        <div className="min-w-0">
          <Link href={`/employees/${employee.id}`} className="truncate text-sm font-medium hover:underline">
            {employee.fullName}
          </Link>
          <WorkloadBadge workload={workload} />
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

export function HierarchyTab({
  departmentId,
  allowsLeadRole,
  hierarchy,
  workloadByUserId,
  canManage,
}: {
  departmentId: string;
  allowsLeadRole: boolean;
  hierarchy: DepartmentHierarchy;
  workloadByUserId: Map<string, UserTaskWorkload>;
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (!allowsLeadRole) {
    return (
      <p className="text-sm text-muted-foreground">
        Роль «Ведущий архитектор» не включена для этого департамента. Администратор может включить
        её на вкладке «Настройки».
      </p>
    );
  }

  function handleChange(employeeId: string, targetId: string | null) {
    startTransition(() => {
      setEmployeeLeadAction(employeeId, targetId).catch((error) => {
        alert(error instanceof Error ? error.message : "Не удалось изменить назначение");
      });
    });
  }

  // Ведущий архитектор — явно назначенный (leadOfManagerId, см.
  // lib/leads/actions.ts::promoteToLeadAction), уже виден в hierarchy.
  // Такой сотрудник — валидная цель "подчиняется" для кого угодно ещё в
  // департаменте, независимо от того, под каким именно руководителем он
  // сейчас числится.
  const leadOptionsBase: DepartmentHierarchyNode[] = hierarchy.managers.flatMap((m) =>
    m.leads.map((l) => ({ id: l.id, fullName: l.fullName, position: l.position })),
  );
  const managerOptionsBase: DepartmentHierarchyNode[] = hierarchy.managers.map((m) => ({
    id: m.id,
    fullName: m.fullName,
    position: m.position,
  }));

  function optionsFor(employeeId: string) {
    return {
      managerOptions: managerOptionsBase.filter((m) => m.id !== employeeId),
      leadOptions: leadOptionsBase.filter((l) => l.id !== employeeId),
    };
  }

  return (
    <div className="space-y-6">
      {hierarchy.managers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          У департамента пока нет назначенного руководителя — назначить можно на вкладке
          «Сотрудники».
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hierarchy.managers.map((manager) => {
            const teamSize =
              manager.leads.reduce((sum, l) => sum + l.reports.length, 0) +
              manager.leads.length +
              manager.directReports.length;
            return (
              <TeamCard
                key={manager.id}
                manager={manager}
                leads={manager.leads.map((l) => l.fullName)}
                employeeCount={teamSize}
                color={getTeamCardColor(manager.id)}
                onClick={() => router.push(`/departments/${departmentId}/teams/${manager.id}`)}
              />
            );
          })}
        </div>
      )}

      {hierarchy.unassigned.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Ещё не распределены
          </p>
          <div className="space-y-2 rounded-xl border bg-card p-3 shadow-card">
            {hierarchy.unassigned.map((employee) => {
              const { managerOptions, leadOptions } = optionsFor(employee.id);
              return (
                <EmployeeRow
                  key={employee.id}
                  employee={employee}
                  currentReportsToId={null}
                  managerOptions={managerOptions}
                  leadOptions={leadOptions}
                  workload={workloadByUserId.get(employee.id)}
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
