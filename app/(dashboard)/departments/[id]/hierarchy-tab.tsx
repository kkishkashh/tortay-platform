"use client";

import { useTransition } from "react";
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
import type { DepartmentHierarchy } from "@/lib/leads/queries";
import { getAvatarColor, getInitials } from "@/lib/utils";

const REPORTS_TO_MANAGER = "__manager__";

type FlatEmployee = { id: string; fullName: string; position: string | null; reportsToId: string | null };

function EmployeeRow({
  employee,
  subtitle,
  isLead,
  currentReportsToId,
  candidateLeads,
  canManage,
  isPending,
  onChange,
}: {
  employee: { id: string; fullName: string; position: string | null };
  subtitle?: string;
  isLead: boolean;
  currentReportsToId: string | null;
  candidateLeads: FlatEmployee[];
  canManage: boolean;
  isPending: boolean;
  onChange: (employeeId: string, leadUserId: string | null) => void;
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
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-medium">{employee.fullName}</p>
            {isLead ? (
              <Badge variant="outline" className="gap-1">
                <Crown className="size-3" />
                Лид
              </Badge>
            ) : null}
          </div>
          <p className="truncate text-xs text-muted-foreground">{subtitle ?? employee.position ?? "—"}</p>
        </div>
      </div>
      {canManage ? (
        <Select
          value={currentReportsToId ?? REPORTS_TO_MANAGER}
          items={[
            { value: REPORTS_TO_MANAGER, label: "Руководителю" },
            ...candidateLeads.map((c) => ({ value: c.id, label: c.fullName })),
          ]}
          onValueChange={(value) => onChange(employee.id, value === REPORTS_TO_MANAGER ? null : value)}
          disabled={isPending}
        >
          <SelectTrigger size="sm" className="w-48 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={REPORTS_TO_MANAGER}>Руководителю</SelectItem>
            {candidateLeads.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  );
}

export function HierarchyTab({
  allowsLeadRole,
  hierarchy,
  employees,
  canManage,
}: {
  allowsLeadRole: boolean;
  hierarchy: DepartmentHierarchy;
  employees: FlatEmployee[];
  canManage: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  if (!allowsLeadRole) {
    return (
      <p className="text-sm text-muted-foreground">
        Роль «Лид» не включена для этого департамента. Администратор может включить её на вкладке
        «Настройки».
      </p>
    );
  }

  function handleChange(employeeId: string, leadUserId: string | null) {
    startTransition(() => {
      setEmployeeLeadAction(employeeId, leadUserId).catch((error) => {
        alert(error instanceof Error ? error.message : "Не удалось изменить подчинение");
      });
    });
  }

  // Кандидаты "Подчиняется" для конкретного сотрудника — любой другой
  // сотрудник департамента, который сам ни на кого не указывает
  // reportsToId (2-уровневое ограничение, см. lib/leads/actions.ts).
  function candidatesFor(employeeId: string) {
    return employees.filter((e) => e.id !== employeeId && e.reportsToId === null);
  }

  return (
    <div className="space-y-6">
      {hierarchy.manager ? (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: getAvatarColor(hierarchy.manager.id) }}
          >
            {getInitials(hierarchy.manager.fullName)}
          </span>
          <div>
            <p className="text-sm font-medium">{hierarchy.manager.fullName}</p>
            <p className="text-xs text-muted-foreground">Руководитель департамента</p>
          </div>
        </div>
      ) : null}

      {hierarchy.leads.length === 0 && hierarchy.unassigned.length === 0 ? (
        <p className="text-sm text-muted-foreground">В этом департаменте пока нет сотрудников.</p>
      ) : null}

      {hierarchy.leads.map((lead) => (
        <div key={lead.id} className="space-y-2 pl-4">
          <EmployeeRow
            employee={lead}
            subtitle={`${lead.position ?? "—"} · подчинённых: ${lead.reports.length}`}
            isLead
            currentReportsToId={null}
            candidateLeads={candidatesFor(lead.id)}
            canManage={canManage}
            isPending={isPending}
            onChange={handleChange}
          />
          <div className="space-y-2 pl-8">
            {lead.reports.map((report) => (
              <EmployeeRow
                key={report.id}
                employee={report}
                isLead={false}
                currentReportsToId={lead.id}
                candidateLeads={candidatesFor(report.id)}
                canManage={canManage}
                isPending={isPending}
                onChange={handleChange}
              />
            ))}
          </div>
        </div>
      ))}

      {hierarchy.unassigned.length > 0 ? (
        <div className="space-y-2 pl-4">
          {hierarchy.leads.length > 0 ? (
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Подчиняются напрямую руководителю
            </p>
          ) : null}
          {hierarchy.unassigned.map((employee) => (
            <EmployeeRow
              key={employee.id}
              employee={employee}
              isLead={false}
              currentReportsToId={null}
              candidateLeads={candidatesFor(employee.id)}
              canManage={canManage}
              isPending={isPending}
              onChange={handleChange}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
