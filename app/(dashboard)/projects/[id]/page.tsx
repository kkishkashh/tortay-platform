import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { ProjectRole } from "@prisma/client";

import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { isFullAdmin } from "@/lib/auth/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DepartmentIcon } from "@/components/departments/department-icon";
import { TaskCard } from "@/components/dashboard/task-card";
import { getCommentsForTasksBatch } from "@/lib/comments/queries";
import { getDocumentsForTasksBatch } from "@/lib/documents/queries";
import { canManageProjectTasks } from "@/lib/tasks/permissions";
import { computeWeightedProgress } from "@/lib/tasks/progress";
import { getTasksForSections } from "@/lib/tasks/queries";
import { getEmployeesForSelect } from "@/lib/employees/queries";
import { getDepartmentTaskStack, type DepartmentTaskStackItem } from "@/lib/departments/queries";
import { prisma } from "@/lib/prisma";
import { getContractSummaryForProject } from "@/lib/contracts/queries";
import { getProjectOutsourcers, getOutsourcersForPicker } from "@/lib/project-outsourcers/queries";
import {
  canManageFinance,
  canManageOperations,
  userManagesDepartmentInProject,
  userIsLeadInProject,
} from "@/lib/projects/permissions";
import { getProjectMembersForTaskAssignment } from "@/lib/projects/queries";
import { getLeadReportIds } from "@/lib/leads/queries";
import {
  PROJECT_STATUS_LABELS,
  SECTION_STATUS_LABELS,
} from "@/lib/projects/status-labels";
import { getAvatarColor, getInitials } from "@/lib/utils";

import { AddProjectMemberDialog } from "./add-project-member-dialog";
import { ArchiveProjectToggle } from "./archive-project-toggle";
import { AssignGipDialog } from "./assign-gip-dialog";
import { ContractSummaryCard } from "./contract-summary-card";
import { EditProjectDialog } from "./edit-project-dialog";
import { HardDeleteProjectDialog } from "./hard-delete-project-dialog";
import { ProjectOutsourcersSection } from "./project-outsourcers-section";
import { ProjectStatusSelect } from "./project-status-select";
import { SectionDatesFields } from "./section-dates-fields";
import { SectionDeadlineHistoryButton } from "./section-deadline-history-button";
import { SectionStatusSelect } from "./section-status-select";
import { TaskDialog } from "./task-dialog";

function formatDate(date: Date) {
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function formatSectionDates(startDate: Date | null, deadline: Date | null) {
  if (!startDate && !deadline) return "Сроки не заданы";
  return `${startDate ? formatDate(startDate) : "?"} — ${deadline ? formatDate(deadline) : "?"}`;
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [session, project, sections, gipMembers, employees, projectMembers] = await Promise.all([
    auth(),
    prisma.project.findUnique({ where: { id } }),
    prisma.section.findMany({
      where: { projectId: id },
      orderBy: { orderIndex: "asc" },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
            managers: { select: { id: true } },
          },
        },
      },
    }),
    // Может быть несколько ГИП на одном проекте (2026-08-06, по прямой
    // просьбе) — раньше здесь стоял findFirst.
    prisma.projectMember.findMany({
      where: { projectId: id, projectRole: ProjectRole.ГИП },
      include: { user: { select: { id: true, fullName: true } } },
    }),
    getEmployeesForSelect(),
    getProjectMembersForTaskAssignment(id),
  ]);
  if (!project) {
    notFound();
  }

  const managesThisProject = session?.user
    ? await userManagesDepartmentInProject(session.user, id)
    : false;

  // Стек задач департамента для диалога "Добавить задачу" (см. TaskDialog) —
  // один запрос на департамент, не на раздел: у нескольких разделов проекта
  // может быть один и тот же департамент (напр. два раздела АР).
  const departmentIdsForTaskStack = Array.from(
    new Set(sections.map((section) => section.department?.id).filter((id): id is string => !!id)),
  );
  const taskStackEntries = await Promise.all(
    departmentIdsForTaskStack.map(async (departmentId) => [
      departmentId,
      await getDepartmentTaskStack(departmentId),
    ] as const),
  );
  const taskStackByDepartmentId = new Map<string, DepartmentTaskStackItem[]>(taskStackEntries);

  // Task 5.2/5.4 (PRD #3 Phase 3) — подчинённые Лида среди участников ЭТОГО
  // проекта. Пусто у всех, кроме Лидов (см. lib/leads/queries.ts::isLead —
  // производный статус, наличие подчинённых само по себе им и является).
  const leadReportUserIds = session?.user ? new Set(await getLeadReportIds(session.user.id)) : new Set<string>();
  const leadAssignableMembers = projectMembers.filter((m) => leadReportUserIds.has(m.userId));
  const isLead = leadReportUserIds.size > 0;
  // Для права менять срок раздела (см. updateSectionDatesAction) — Лид
  // может продлевать срок ТОЛЬКО в разделах СВОЕГО департамента.
  const currentUserHomeDepartmentId = session?.user
    ? (await prisma.user.findUnique({ where: { id: session.user.id }, select: { homeDepartmentId: true } }))
        ?.homeDepartmentId ?? null
    : null;

  const canManageOutsourcers = session?.user ? await canManageFinance(session.user) : false;
  const [projectOutsourcers, outsourcerPickerOptions, contractSummary] = await Promise.all([
    // Аутсорсеры проекта (контрагенты, суммы, транши) — видны только тем,
    // кто их может привязывать/редактировать: раньше эти данные всегда
    // отдавались в RSC-payload, а компонент скрывал карточку только когда
    // список пуст, из-за чего любой участник проекта видел уже привязанных
    // аутсорсеров. Теперь как и с getOutsourcersForPicker ниже — не отдаём
    // то, что UI всё равно скрывает от роли.
    canManageOutsourcers ? getProjectOutsourcers(id) : Promise.resolve([]),
    // Полный список аутсорсеров компании — только для тех, кто реально
    // может их привязывать (см. урок про getEmployeesForManagerAssignment:
    // не отдавать в RSC-payload то, что UI всё равно скрывает от роли).
    canManageOutsourcers ? getOutsourcersForPicker() : Promise.resolve([]),
    getContractSummaryForProject(id),
  ]);

  // Раньше это был Promise.all(sections.map(async section => ... await
  // Promise.all(tasks.map(async task => ...)))) — запрос комментариев и
  // документов НА КАЖДУЮ задачу отдельно. При десятках задач это десятки
  // последовательных round-trip'ов к Neon подряд — именно это тормозило
  // страницу проекта. Теперь: один пакетный запрос на все разделы + один
  // пакетный запрос на все комментарии + один на все документы.
  const sectionIds = sections.map((section) => section.id);
  const tasksBySectionId = await getTasksForSections(sectionIds);
  const allTaskIds = Array.from(tasksBySectionId.values())
    .flat()
    .map((task) => task.id);
  const [commentsByTaskId, documentsByTaskId] = await Promise.all([
    getCommentsForTasksBatch(allTaskIds),
    getDocumentsForTasksBatch(allTaskIds),
  ]);

  const sectionsWithTasks = sections.map((section) => {
    const tasks = tasksBySectionId.get(section.id) ?? [];
    const tasksWithComments = tasks.map((task) => ({
      task,
      comments: commentsByTaskId.get(task.id) ?? [],
      documents: documentsByTaskId.get(task.id) ?? [],
    }));
    return {
      section,
      tasksWithComments,
      canManageTasks: session?.user ? canManageProjectTasks(session.user, section) : false,
      canEditDates: isLead && section.department?.id === currentUserHomeDepartmentId,
      progress: computeWeightedProgress(tasks),
    };
  });

  const canChangeStatus = session?.user
    ? canManageOperations(session.user, managesThisProject)
    : false;
  // "Добавить участника" (2026-08-06, по прямой просьбе) — та же операционная
  // проверка, что и canChangeStatus, плюс отдельный узкий кейс: Лид
  // департамента с разделом в этом проекте (см. userIsLeadInProject).
  const canAddMember =
    canChangeStatus || (!!session?.user && (await userIsLeadInProject(session.user, id)));
  // Жёсткое удаление проекта — строго АДМИН (см. lib/projects/actions.ts::deleteProjectAction).
  const isHead = !!session?.user && isFullAdmin(session.user.systemRole);
  const currentUserId = session?.user?.id;

  return (
    <>
      <PageHeader
        title={project.name}
        action={
          canChangeStatus ? (
            <div className="flex items-center gap-2">
              <EditProjectDialog projectId={project.id} name={project.name} />
              <ArchiveProjectToggle projectId={project.id} isArchived={project.isArchived} />
              {isHead ? (
                <HardDeleteProjectDialog projectId={project.id} name={project.name} />
              ) : null}
            </div>
          ) : undefined
        }
      />
      <div className="p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {canChangeStatus ? (
              <ProjectStatusSelect projectId={project.id} status={project.status} />
            ) : (
              <Badge variant="secondary">{PROJECT_STATUS_LABELS[project.status]}</Badge>
            )}
            {project.isArchived ? <Badge variant="secondary">В архиве</Badge> : null}
            {project.overdueReason ? (
              <Badge
                variant="outline"
                className="border-[#c47a12]/30 text-[#c47a12]"
                title="Дедлайн уже прошёл на момент создания проекта"
              >
                Создан просроченным
              </Badge>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            {gipMembers.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                {gipMembers.map((member) => (
                  <div key={member.id} className="flex items-center gap-2">
                    <span
                      className="flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                      style={{ backgroundColor: getAvatarColor(member.user.id) }}
                    >
                      {getInitials(member.user.fullName)}
                    </span>
                    <div className="leading-tight">
                      <p className="text-xs text-muted-foreground">ГИП</p>
                      <p className="text-sm font-medium">{member.user.fullName}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : canChangeStatus ? (
              <p className="text-sm text-muted-foreground">ГИП не назначен</p>
            ) : null}
            {canChangeStatus ? (
              <AssignGipDialog
                projectId={project.id}
                gipMembers={gipMembers.map((m) => ({ id: m.user.id, fullName: m.user.fullName }))}
                employees={employees}
                currentUserId={currentUserId ?? null}
              />
            ) : null}
            {canAddMember ? (
              <AddProjectMemberDialog
                projectId={project.id}
                employees={employees}
                currentUserId={currentUserId ?? null}
              />
            ) : null}
          </div>
        </div>

        {project.overdueReason ? (
          <div className="mb-6 space-y-1.5 rounded-lg border border-[#c47a12]/30 bg-[#c47a12]/5 px-4 py-3 text-sm">
            <p className="font-medium text-[#c47a12]">Проект создан с уже прошедшим дедлайном</p>
            <p className="text-muted-foreground">
              Первоначальная дата окончания: {project.endDate ? formatDate(project.endDate) : "—"}
              {" · "}
              Окончательный дедлайн:{" "}
              {project.finalDeadline ? formatDate(project.finalDeadline) : "—"}
            </p>
            <p className="text-muted-foreground">Причина: {project.overdueReason}</p>
          </div>
        ) : null}

        {contractSummary ? (
          <div className="mb-6">
            <ContractSummaryCard summary={contractSummary} />
          </div>
        ) : null}

        <ProjectOutsourcersSection
          projectId={project.id}
          outsourcers={projectOutsourcers}
          pickerOptions={outsourcerPickerOptions}
          canManage={canManageOutsourcers}
        />

        <div className="mt-8 space-y-8">
          {sectionsWithTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Разделов пока нет.</p>
          ) : (
            sectionsWithTasks.map(({ section, tasksWithComments, canManageTasks, canEditDates, progress }) => (
              <div key={section.id} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    {section.department ? (
                      <span
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white"
                        style={{ backgroundColor: section.department.color }}
                      >
                        <DepartmentIcon name={section.department.icon} className="size-4" />
                      </span>
                    ) : (
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        —
                      </span>
                    )}
                    <div>
                      <p className="text-sm font-medium">{section.name}</p>
                      {!section.department ? (
                        <p className="text-xs text-muted-foreground">Без отдела</p>
                      ) : null}
                      {progress !== null ? (
                        <div className="mt-1 flex items-center gap-2">
                          <Progress value={progress} className="w-28" />
                          <span className="text-xs text-muted-foreground tabular-nums">{progress}%</span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {canChangeStatus || canEditDates ? (
                      <SectionDatesFields
                        sectionId={section.id}
                        startDate={section.startDate}
                        deadline={section.deadline}
                      />
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        {formatSectionDates(section.startDate, section.deadline)}
                        <SectionDeadlineHistoryButton sectionId={section.id} />
                      </span>
                    )}
                    {canChangeStatus ? (
                      <SectionStatusSelect sectionId={section.id} status={section.status} />
                    ) : (
                      <Badge variant="secondary">{SECTION_STATUS_LABELS[section.status]}</Badge>
                    )}
                  </div>
                </div>

                {tasksWithComments.length === 0 ? (
                  <p className="pl-1 text-sm text-muted-foreground">Задач пока нет.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {tasksWithComments.map(({ task, comments, documents }) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        comments={comments}
                        documents={documents}
                        currentUserId={currentUserId}
                        canManage={canManageTasks}
                        isAssignee={task.assignee?.userId === currentUserId}
                        projectMembers={projectMembers}
                        leadAssignableMembers={leadAssignableMembers}
                      />
                    ))}
                  </div>
                )}

                {canManageTasks ? (
                  <TaskDialog
                    mode="create"
                    sectionId={section.id}
                    projectMembers={projectMembers}
                    taskStack={section.department ? (taskStackByDepartmentId.get(section.department.id) ?? []) : []}
                    trigger={
                      <Button variant="outline" size="sm">
                        <Plus className="size-3.5" />
                        Добавить задачу
                      </Button>
                    }
                  />
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
