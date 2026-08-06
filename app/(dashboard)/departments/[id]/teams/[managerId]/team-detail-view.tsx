"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Crown, UserMinus, UserPlus } from "lucide-react";
import { ProjectRole } from "@prisma/client";

import { demoteLeadAction, promoteToLeadAction, setEmployeeLeadAction } from "@/lib/leads/actions";
import { addProjectMemberAction } from "@/lib/projects/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxClear,
  ComboboxCollection,
  ComboboxContent,
  ComboboxGroup,
  ComboboxGroupLabel,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
} from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DepartmentHierarchy, DepartmentHierarchyNode } from "@/lib/leads/queries";
import type { UserProjectItem } from "@/lib/projects/queries";
import type { UserActiveTask } from "@/lib/tasks/queries";
import { TASK_STATUS_BADGE_VARIANT, TASK_STATUS_LABELS } from "@/lib/projects/status-labels";
import { getAvatarColor, getInitials } from "@/lib/utils";

const REPORTS_TO_NONE = "__none__";

type PickerItem = { value: string; label: string; sublabel?: string };
type PickerGroup = { label: string | null; items: PickerItem[] };

function comboboxFilter(item: PickerItem, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return item.label.toLowerCase().includes(q) || (item.sublabel?.toLowerCase().includes(q) ?? false);
}

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

// Прикреплённые проекты блока (Руководителя или Ведущего архитектора) —
// обычное членство ProjectMember (та же связь, что и "Добавить участника"
// на странице проекта, см. lib/projects/actions.ts::addProjectMemberAction),
// без отдельного поля в схеме. canEdit — может ли ЭТОТ зритель прикреплять
// сюда новые проекты (владелец блока сам, руководитель департамента или
// администратор).
function ProjectsBlock({
  ownerId,
  ownerRole,
  projects,
  departmentProjects,
  canEdit,
  isPending,
  onAttach,
}: {
  ownerId: string;
  ownerRole: ProjectRole;
  projects: UserProjectItem[];
  departmentProjects: { id: string; name: string }[];
  canEdit: boolean;
  isPending: boolean;
  onAttach: (ownerId: string, projectId: string, role: ProjectRole) => void;
}) {
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [pickerResetKey, setPickerResetKey] = useState(0);
  const attachedIds = new Set(projects.map((p) => p.id));
  const attachable = departmentProjects.filter((p) => !attachedIds.has(p.id));

  function handleAttach() {
    if (!selectedProjectId) return;
    onAttach(ownerId, selectedProjectId, ownerRole);
    setSelectedProjectId("");
    setPickerResetKey((key) => key + 1);
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Проекты</p>
      {projects.length === 0 ? (
        <p className="text-xs text-muted-foreground">Нет прикреплённых проектов</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground hover:bg-secondary/80"
            >
              {project.name}
            </Link>
          ))}
        </div>
      )}
      {canEdit && attachable.length > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Combobox
            key={pickerResetKey}
            items={attachable.map((p) => ({ value: p.id, label: p.name }))}
            onValueChange={(item) => setSelectedProjectId(item?.value ?? "")}
            itemToStringLabel={(item: PickerItem) => item.label}
            filter={comboboxFilter}
            disabled={isPending}
          >
            <ComboboxInputGroup className="w-full sm:w-72">
              <ComboboxInput placeholder="Найти проект…" />
              <ComboboxClear />
            </ComboboxInputGroup>
            <ComboboxContent emptyMessage="Никого не нашлось">
              {(item: PickerItem) => (
                <ComboboxItem key={item.value} value={item}>
                  {item.label}
                </ComboboxItem>
              )}
            </ComboboxContent>
          </Combobox>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAttach}
            disabled={isPending || !selectedProjectId}
          >
            Прикрепить
          </Button>
        </div>
      ) : null}
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
  canRemove,
  isPending,
  onChange,
  onRemove,
}: {
  employee: DepartmentHierarchyNode;
  currentReportsToId: string | null;
  managerOptions: DepartmentHierarchyNode[];
  leadOptions: DepartmentHierarchyNode[];
  tasks: UserActiveTask[] | undefined;
  canManage: boolean;
  canRemove: boolean;
  isPending: boolean;
  onChange: (employeeId: string, targetId: string | null) => void;
  onRemove: (employeeId: string) => void;
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
      <div className="flex shrink-0 items-center gap-1.5">
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
            <SelectTrigger size="sm" className="w-56">
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
        ) : canRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onRemove(employee.id)}
            disabled={isPending}
            title="Убрать из команды"
          >
            <UserMinus className="size-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function TeamDetailView({
  departmentId,
  hierarchy,
  managerId,
  tasksByUserId,
  canManage,
  viewerId,
  departmentProjects,
  projectsByUserId,
}: {
  departmentId: string;
  hierarchy: DepartmentHierarchy;
  managerId: string;
  tasksByUserId: Map<string, UserActiveTask[]>;
  canManage: boolean;
  viewerId: string | null;
  departmentProjects: { id: string; name: string }[];
  projectsByUserId: Map<string, UserProjectItem[]>;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [promoteCandidateId, setPromoteCandidateId] = useState("");
  const [promotePickerResetKey, setPromotePickerResetKey] = useState(0);
  const manager = hierarchy.managers.find((m) => m.id === managerId);

  function runAction(action: () => Promise<void>, fallbackMessage: string) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : fallbackMessage);
      }
    });
  }

  function handleChange(employeeId: string, targetId: string | null) {
    runAction(
      () => setEmployeeLeadAction(employeeId, targetId),
      "Не удалось изменить назначение",
    );
  }

  function handleAttachProject(ownerId: string, projectId: string, role: ProjectRole) {
    runAction(
      () => addProjectMemberAction(projectId, ownerId, role),
      "Не удалось прикрепить проект",
    );
  }

  function handlePromote(managerIdToAssign: string) {
    if (!promoteCandidateId) return;
    runAction(
      () => promoteToLeadAction(promoteCandidateId, managerIdToAssign),
      "Не удалось назначить Ведущего архитектора",
    );
    setPromoteCandidateId("");
    setPromotePickerResetKey((key) => key + 1);
  }

  // Переназначение УЖЕ действующего Ведущего архитектора другому
  // руководителю ("Подчиняется" у его блока) — то же действие
  // (promoteToLeadAction идемпотентно), но БЕЗ состояния комбобокса выше
  // (leadId уже известен из самого блока).
  function handleReassignLead(leadId: string, managerIdToAssign: string) {
    runAction(
      () => promoteToLeadAction(leadId, managerIdToAssign),
      "Не удалось переназначить Ведущего архитектора",
    );
  }

  function handleDemote(leadId: string) {
    runAction(() => demoteLeadAction(leadId), "Не удалось снять статус Ведущего архитектора");
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

  const managerOptionsBase: DepartmentHierarchyNode[] = hierarchy.managers.map((m) => ({
    id: m.id,
    fullName: m.fullName,
    position: m.position,
  }));
  const leadOptionsBase: DepartmentHierarchyNode[] = hierarchy.managers.flatMap((m) => m.leads);

  function optionsFor(employeeId: string) {
    return {
      managerOptions: managerOptionsBase.filter((m) => m.id !== employeeId),
      leadOptions: leadOptionsBase.filter((l) => l.id !== employeeId),
    };
  }

  // Кандидаты на назначение Ведущим архитектором ЭТОГО руководителя — те,
  // кто уже у него напрямую в команде, плюс департамент-wide "Ещё не
  // распределены" (та же группировка, что и в employees-tab.tsx для
  // назначения руководителя).
  const promoteGroups: PickerGroup[] = [
    ...(manager.directReports.length > 0
      ? [{ label: "В команде руководителя", items: manager.directReports.map((e) => ({ value: e.id, label: e.fullName })) }]
      : []),
    ...(hierarchy.unassigned.length > 0
      ? [{ label: "Ещё не распределены", items: hierarchy.unassigned.map((e) => ({ value: e.id, label: e.fullName })) }]
      : []),
  ];

  // Кандидаты, которых Ведущий архитектор может забрать в СВОЮ команду —
  // те же группы, что и promoteGroups выше (свои прямые сотрудники
  // руководителя + ещё не распределённые), не весь департамент целиком.
  const leadTeamCandidateGroups: PickerGroup[] = promoteGroups;

  return (
    <div className="space-y-6">
      <Link
        href={`/departments/${departmentId}`}
        className="text-sm text-muted-foreground hover:underline"
      >
        ← Назад к департаменту
      </Link>

      <div className="space-y-3 rounded-xl border bg-card p-4 shadow-card">
        <div className="flex items-center gap-2.5">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: getAvatarColor(manager.id) }}
          >
            {getInitials(manager.fullName)}
          </span>
          <div>
            <p className="text-sm font-medium">{manager.fullName}</p>
            <p className="text-xs text-muted-foreground">Руководитель</p>
          </div>
        </div>
        <div className="border-t pt-3">
          <ProjectsBlock
            ownerId={manager.id}
            ownerRole={ProjectRole.МЕНЕДЖЕР}
            projects={projectsByUserId.get(manager.id) ?? []}
            departmentProjects={departmentProjects}
            canEdit={canManage}
            isPending={isPending}
            onAttach={handleAttachProject}
          />
        </div>
      </div>

      {canManage && promoteGroups.length > 0 ? (
        <div className="space-y-2 rounded-xl border bg-card p-4 shadow-card">
          <p className="text-sm font-medium">Назначить Ведущим архитектором</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Combobox
                key={promotePickerResetKey}
                items={promoteGroups}
                onValueChange={(item) => setPromoteCandidateId(item?.value ?? "")}
                itemToStringLabel={(item: PickerItem) => item.label}
                filter={comboboxFilter}
                disabled={isPending}
              >
                <ComboboxInputGroup className="w-full sm:w-80">
                  <ComboboxInput placeholder="Найти сотрудника…" />
                  <ComboboxClear />
                </ComboboxInputGroup>
                <ComboboxContent emptyMessage="Никого не нашлось">
                  {(group: PickerGroup) => (
                    <ComboboxGroup key={group.label ?? "__unlabeled__"} items={group.items}>
                      {group.label ? <ComboboxGroupLabel>{group.label}</ComboboxGroupLabel> : null}
                      <ComboboxCollection>
                        {(item: PickerItem) => <ComboboxItem key={item.value} value={item}>{item.label}</ComboboxItem>}
                      </ComboboxCollection>
                    </ComboboxGroup>
                  )}
                </ComboboxContent>
              </Combobox>
            </div>
            <Button
              type="button"
              onClick={() => handlePromote(managerId)}
              disabled={isPending || !promoteCandidateId}
            >
              <UserPlus className="size-4" />
              Назначить
            </Button>
          </div>
        </div>
      ) : null}

      {manager.leads.length === 0 && manager.directReports.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          У этого руководителя пока никого не закреплено — назначьте на вкладке «Структура», выбрав
          {" "}
          {manager.fullName} в списке «Ещё не распределены».
        </p>
      ) : null}

      {manager.leads.map((lead) => {
        const isOwnBlock = viewerId === lead.id;
        const canEditThisBlock = canManage || isOwnBlock;
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
                      Ведущий архитектор
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">в команде: {lead.reports.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canManage ? (
                  <>
                    <p className="text-xs text-muted-foreground">Подчиняется:</p>
                    <Select
                      value={managerId}
                      items={managerOptionsBase.map((m) => ({ value: m.id, label: m.fullName }))}
                      onValueChange={(value) => {
                        if (value && value !== managerId) handleReassignLead(lead.id, value);
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDemote(lead.id)}
                      disabled={isPending || lead.reports.length > 0}
                      title={
                        lead.reports.length > 0
                          ? "Сначала переназначьте сотрудников его команды"
                          : "Снять статус Ведущего архитектора"
                      }
                    >
                      <UserMinus className="size-4" />
                    </Button>
                  </>
                ) : null}
              </div>
            </div>

            <div className="border-t pt-3">
              <ProjectsBlock
                ownerId={lead.id}
                ownerRole={ProjectRole.ВЕДУЩИЙ_СПЕЦИАЛИСТ}
                projects={projectsByUserId.get(lead.id) ?? []}
                departmentProjects={departmentProjects}
                canEdit={canEditThisBlock}
                isPending={isPending}
                onAttach={handleAttachProject}
              />
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
                    canRemove={isOwnBlock}
                    isPending={isPending}
                    onChange={handleChange}
                    onRemove={(employeeId) => handleChange(employeeId, null)}
                  />
                ))
              )}
            </div>

            {canEditThisBlock && leadTeamCandidateGroups.length > 0 ? (
              <AddTeamMemberControl
                groups={leadTeamCandidateGroups}
                isPending={isPending}
                onAdd={(employeeId) => handleChange(employeeId, lead.id)}
              />
            ) : null}
          </div>
        );
      })}

      {manager.directReports.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Без ведущего архитектора — напрямую у {manager.fullName.split(" ")[0]}
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
                  canRemove={false}
                  isPending={isPending}
                  onChange={handleChange}
                  onRemove={() => {}}
                />
              );
            })}
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

// Компактный Combobox+кнопка "Добавить сотрудника" — тот же приём, что и
// назначение Ведущего архитектора выше, переиспользуется и для
// самообслуживания Ведущего архитектора (собирает СВОЮ команду), и для
// руководителя/админа (canManage).
function AddTeamMemberControl({
  groups,
  isPending,
  onAdd,
}: {
  groups: PickerGroup[];
  isPending: boolean;
  onAdd: (employeeId: string) => void;
}) {
  const [candidateId, setCandidateId] = useState("");
  const [resetKey, setResetKey] = useState(0);

  function handleAdd() {
    if (!candidateId) return;
    onAdd(candidateId);
    setCandidateId("");
    setResetKey((key) => key + 1);
  }

  return (
    <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-2">
        <Combobox
          key={resetKey}
          items={groups}
          onValueChange={(item) => setCandidateId(item?.value ?? "")}
          itemToStringLabel={(item: PickerItem) => item.label}
          filter={comboboxFilter}
          disabled={isPending}
        >
          <ComboboxInputGroup className="w-full sm:w-80">
            <ComboboxInput placeholder="Добавить сотрудника в команду…" />
            <ComboboxClear />
          </ComboboxInputGroup>
          <ComboboxContent emptyMessage="Никого не нашлось">
            {(group: PickerGroup) => (
              <ComboboxGroup key={group.label ?? "__unlabeled__"} items={group.items}>
                {group.label ? <ComboboxGroupLabel>{group.label}</ComboboxGroupLabel> : null}
                <ComboboxCollection>
                  {(item: PickerItem) => <ComboboxItem key={item.value} value={item}>{item.label}</ComboboxItem>}
                </ComboboxCollection>
              </ComboboxGroup>
            )}
          </ComboboxContent>
        </Combobox>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={handleAdd} disabled={isPending || !candidateId}>
        <UserPlus className="size-4" />
        Добавить
      </Button>
    </div>
  );
}
