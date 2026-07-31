"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Crown } from "lucide-react";

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

// Тот же набор цветов, что и у StatCard на дашборде (components/dashboard/
// stat-card.tsx) — блоки Лидов должны читаться как отдельные карточки, а не
// сливаться в один список, поэтому переиспользуем тот же язык: цветной
// акцент + приподнятая карточка с тенью.
const LEAD_CARD_ACCENTS = [
  "from-[#2563eb] to-[#1741a6]",
  "from-[#16a34a] to-[#0d7a37]",
  "from-[#f0ac3d] to-[#c47a12]",
  "from-[#7c3aed] to-[#5423ab]",
];

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
  const [expandedLeadIds, setExpandedLeadIds] = useState<Set<string>>(new Set());

  function toggleLead(leadId: string) {
    setExpandedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) {
        next.delete(leadId);
      } else {
        next.add(leadId);
      }
      return next;
    });
  }

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
        alert(error instanceof Error ? error.message : "Не удалось изменить назначение");
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

      {hierarchy.leads.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hierarchy.leads.map((lead, index) => {
            const isExpanded = expandedLeadIds.has(lead.id);
            return (
              <div
                key={lead.id}
                className="overflow-hidden rounded-xl border bg-card shadow-card transition-all duration-200 hover:shadow-card-hover"
              >
                <div className={`h-1.5 bg-linear-to-r ${LEAD_CARD_ACCENTS[index % LEAD_CARD_ACCENTS.length]}`} />
                <button
                  type="button"
                  onClick={() => toggleLead(lead.id)}
                  className="flex w-full items-center justify-between gap-3 p-4 text-left"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                      style={{ backgroundColor: getAvatarColor(lead.id) }}
                    >
                      {getInitials(lead.fullName)}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-medium">{lead.fullName}</p>
                        <Badge variant="outline" className="gap-1">
                          <Crown className="size-3" />
                          Лид
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {lead.position ?? "—"} · в команде: {lead.reports.length}
                      </p>
                    </div>
                  </div>
                  <ChevronDown
                    className={`size-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  />
                </button>
                {isExpanded ? (
                  <div className="space-y-2 border-t bg-muted/30 p-3">
                    {canManage ? (
                      <Select
                        value={REPORTS_TO_MANAGER}
                        items={[
                          { value: REPORTS_TO_MANAGER, label: "Руководителю" },
                          ...candidatesFor(lead.id).map((c) => ({ value: c.id, label: c.fullName })),
                        ]}
                        onValueChange={(value) =>
                          handleChange(lead.id, value === REPORTS_TO_MANAGER ? null : value)
                        }
                        disabled={isPending}
                      >
                        <SelectTrigger size="sm" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={REPORTS_TO_MANAGER}>Руководителю</SelectItem>
                          {candidatesFor(lead.id).map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.fullName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : null}
                    {lead.reports.length === 0 ? (
                      <p className="text-xs text-muted-foreground">В команде пока никого нет.</p>
                    ) : (
                      <div className="space-y-2">
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
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {hierarchy.unassigned.length > 0 ? (
        <div className="space-y-2 pl-4">
          {hierarchy.leads.length > 0 ? (
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Напрямую под руководством руководителя департамента
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
