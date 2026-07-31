"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, ChevronDown, Crown, ShieldCheck } from "lucide-react";
import Link from "next/link";

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
import type { UserTaskWorkload } from "@/lib/tasks/queries";
import { WORKLOAD_META } from "@/lib/workload";
import { getAvatarColor, getInitials } from "@/lib/utils";

const REPORTS_TO_NONE = "__none__";

// Тот же набор цветов, что и у StatCard на дашборде (components/dashboard/
// stat-card.tsx) — блоки Лидов и руководителей должны читаться как отдельные
// карточки, а не сливаться в один список: цветной акцент + приподнятая
// карточка с тенью.
const LEAD_CARD_ACCENTS = [
  "from-[#2563eb] to-[#1741a6]",
  "from-[#16a34a] to-[#0d7a37]",
  "from-[#7c3aed] to-[#5423ab]",
  "from-[#159c46] to-[#0d7a37]",
];
const MANAGER_CARD_ACCENT = "from-[#f0ac3d] to-[#c47a12]";

type FlatEmployee = { id: string; fullName: string; position: string | null; reportsToId: string | null };

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
  allowsLeadRole,
  hierarchy,
  employees,
  workloadByUserId,
  canManage,
}: {
  allowsLeadRole: boolean;
  hierarchy: DepartmentHierarchy;
  employees: FlatEmployee[];
  workloadByUserId: Map<string, UserTaskWorkload>;
  canManage: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [expandedManagerIds, setExpandedManagerIds] = useState<Set<string>>(new Set());
  const [expandedLeadIds, setExpandedLeadIds] = useState<Set<string>>(new Set());

  function toggleSet(setter: typeof setExpandedManagerIds, id: string) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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

  function handleChange(employeeId: string, targetId: string | null) {
    startTransition(() => {
      setEmployeeLeadAction(employeeId, targetId).catch((error) => {
        alert(error instanceof Error ? error.message : "Не удалось изменить назначение");
      });
    });
  }

  const managerIds = new Set(hierarchy.managers.map((m) => m.id));
  const managerOptionsBase: DepartmentHierarchyNode[] = hierarchy.managers.map((m) => ({
    id: m.id,
    fullName: m.fullName,
    position: m.position,
  }));

  // Лид — сотрудник, чей reportsToId уже указывает на одного из
  // руководителей (см. lib/leads/actions.ts — 2 уровня: Руководитель →
  // Лид → Сотрудник). Такой сотрудник — валидная цель "подчиняется" для
  // кого угодно ещё в департаменте, независимо от того, под каким именно
  // руководителем он сейчас числится.
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
      {hierarchy.managers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          У департамента пока нет назначенного руководителя — назначить можно на вкладке
          «Сотрудники».
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hierarchy.managers.map((manager) => {
            const isExpanded = expandedManagerIds.has(manager.id);
            const teamSize =
              manager.leads.reduce((sum, l) => sum + l.reports.length, 0) +
              manager.leads.length +
              manager.directReports.length;
            return (
              <div
                key={manager.id}
                className={`overflow-hidden rounded-xl border bg-card shadow-card transition-all duration-200 hover:shadow-card-hover ${
                  isExpanded ? "sm:col-span-2 lg:col-span-3" : ""
                }`}
              >
                <div className={`h-1.5 bg-linear-to-r ${MANAGER_CARD_ACCENT}`} />
                <button
                  type="button"
                  onClick={() => toggleSet(setExpandedManagerIds, manager.id)}
                  className="flex w-full items-center justify-between gap-3 p-4 text-left"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                      style={{ backgroundColor: getAvatarColor(manager.id) }}
                    >
                      {getInitials(manager.fullName)}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-medium">{manager.fullName}</p>
                        <Badge variant="outline" className="gap-1">
                          <ShieldCheck className="size-3" />
                          Руководитель
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        Лидов: {manager.leads.length} · в команде: {teamSize}
                      </p>
                    </div>
                  </div>
                  <ChevronDown
                    className={`size-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  />
                </button>

                {isExpanded ? (
                  <div className="space-y-3 border-t bg-muted/30 p-3">
                    {manager.leads.length === 0 && manager.directReports.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        У этого руководителя пока никого не закреплено.
                      </p>
                    ) : null}

                    {manager.leads.length > 0 ? (
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {manager.leads.map((lead, index) => {
                          const leadExpanded = expandedLeadIds.has(lead.id);
                          return (
                        <div
                          key={lead.id}
                          className={`overflow-hidden rounded-lg border bg-card shadow-card ${leadExpanded ? "md:col-span-2" : ""}`}
                        >
                          <div
                            className={`h-1 bg-linear-to-r ${LEAD_CARD_ACCENTS[index % LEAD_CARD_ACCENTS.length]}`}
                          />
                          <button
                            type="button"
                            onClick={() => toggleSet(setExpandedLeadIds, lead.id)}
                            className="flex w-full items-center justify-between gap-3 p-3 text-left"
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <span
                                className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
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
                                  в команде: {lead.reports.length}
                                </p>
                              </div>
                            </div>
                            <ChevronDown
                              className={`size-4 shrink-0 text-muted-foreground transition-transform ${leadExpanded ? "rotate-180" : ""}`}
                            />
                          </button>
                          {leadExpanded ? (
                            <div className="space-y-2 border-t bg-muted/40 p-2.5">
                              {canManage ? (
                                <div className="flex items-center gap-2">
                                  <p className="shrink-0 text-xs text-muted-foreground">Подчиняется:</p>
                                  <Select
                                    value={manager.id}
                                    items={managerOptionsBase.map((m) => ({ value: m.id, label: m.fullName }))}
                                    onValueChange={(value) => {
                                      if (value && value !== manager.id) handleChange(lead.id, value);
                                    }}
                                    disabled={isPending}
                                  >
                                    <SelectTrigger size="sm" className="w-full">
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
                              {lead.reports.length === 0 ? (
                                <p className="text-xs text-muted-foreground">В команде пока никого нет.</p>
                              ) : (
                                lead.reports.map((report) => (
                                  <EmployeeRow
                                    key={report.id}
                                    employee={report}
                                    currentReportsToId={lead.id}
                                    managerOptions={managerOptionsBase.filter((m) => m.id !== report.id)}
                                    leadOptions={leadOptionsBase.filter((l) => l.id !== report.id)}
                                    workload={workloadByUserId.get(report.id)}
                                    canManage={canManage}
                                    isPending={isPending}
                                    onChange={handleChange}
                                  />
                                ))
                              )}
                            </div>
                          ) : null}
                        </div>
                          );
                        })}
                      </div>
                    ) : null}

                    {manager.directReports.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Без Лида — напрямую у {manager.fullName.split(" ")[0]}
                        </p>
                        {manager.directReports.map((employee) => {
                          const { managerOptions, leadOptions } = optionsFor(employee.id);
                          return (
                            <EmployeeRow
                              key={employee.id}
                              employee={employee}
                              currentReportsToId={manager.id}
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
                    ) : null}
                  </div>
                ) : null}
              </div>
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
