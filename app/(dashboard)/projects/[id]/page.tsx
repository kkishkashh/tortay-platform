import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { ProjectRole } from "@prisma/client";

import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DepartmentIcon } from "@/components/departments/department-icon";
import { TaskCard } from "@/components/dashboard/task-card";
import { getCommentsForTask } from "@/lib/comments/queries";
import { getDocumentsForTask } from "@/lib/documents/queries";
import { canManageProjectTasks } from "@/lib/tasks/permissions";
import { getTasksForSection } from "@/lib/tasks/queries";
import { getEmployeesForSelect } from "@/lib/employees/queries";
import { prisma } from "@/lib/prisma";
import { canManageOperations } from "@/lib/projects/permissions";
import { getProjectMembersForTaskAssignment } from "@/lib/projects/queries";
import {
  PROJECT_STATUS_LABELS,
  SECTION_STATUS_LABELS,
} from "@/lib/projects/status-labels";
import { getAvatarColor, getInitials } from "@/lib/utils";

import { AssignGipDialog } from "./assign-gip-dialog";
import { DeleteProjectDialog } from "./delete-project-dialog";
import { EditProjectDialog } from "./edit-project-dialog";
import { ProjectStatusSelect } from "./project-status-select";
import { SectionDatesFields } from "./section-dates-fields";
import { SectionStatusSelect } from "./section-status-select";
import { TaskDialog } from "./task-dialog";

function formatSectionDates(startDate: Date | null, deadline: Date | null) {
  if (!startDate && !deadline) return "Сроки не заданы";
  const format = (date: Date) =>
    date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" });
  return `${startDate ? format(startDate) : "?"} — ${deadline ? format(deadline) : "?"}`;
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [session, project, sections, gipMember, employees, projectMembers] = await Promise.all([
    auth(),
    prisma.project.findUnique({ where: { id } }),
    prisma.section.findMany({
      where: { projectId: id },
      orderBy: { orderIndex: "asc" },
      include: { department: { select: { id: true, name: true, color: true, icon: true, managerId: true } } },
    }),
    prisma.projectMember.findFirst({
      where: { projectId: id, projectRole: ProjectRole.ГИП },
      include: { user: { select: { id: true, fullName: true } } },
    }),
    getEmployeesForSelect(),
    getProjectMembersForTaskAssignment(id),
  ]);
  if (!project) {
    notFound();
  }

  const sectionsWithTasks = await Promise.all(
    sections.map(async (section) => {
      const tasks = await getTasksForSection(section.id);
      const tasksWithComments = await Promise.all(
        tasks.map(async (task) => ({
          task,
          comments: await getCommentsForTask(task.id),
          documents: await getDocumentsForTask(task.id),
        })),
      );
      return {
        section,
        tasksWithComments,
        canManageTasks: session?.user ? canManageProjectTasks(session.user, section) : false,
      };
    }),
  );

  const canChangeStatus = session?.user ? canManageOperations(session.user) : false;
  const currentUserId = session?.user?.id;

  return (
    <>
      <PageHeader
        title={project.name}
        action={
          canChangeStatus ? (
            <div className="flex items-center gap-2">
              <EditProjectDialog projectId={project.id} name={project.name} />
              <DeleteProjectDialog projectId={project.id} name={project.name} />
            </div>
          ) : undefined
        }
      />
      <div className="p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {canChangeStatus ? (
            <ProjectStatusSelect projectId={project.id} status={project.status} />
          ) : (
            <Badge variant="secondary">{PROJECT_STATUS_LABELS[project.status]}</Badge>
          )}

          <div className="flex items-center gap-3">
            {gipMember ? (
              <div className="flex items-center gap-2">
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: getAvatarColor(gipMember.user.id) }}
                >
                  {getInitials(gipMember.user.fullName)}
                </span>
                <div className="leading-tight">
                  <p className="text-xs text-muted-foreground">ГИП</p>
                  <p className="text-sm font-medium">{gipMember.user.fullName}</p>
                </div>
              </div>
            ) : canChangeStatus ? (
              <p className="text-sm text-muted-foreground">ГИП не назначен</p>
            ) : null}
            {canChangeStatus ? (
              <AssignGipDialog
                projectId={project.id}
                gipUserId={gipMember?.user.id ?? null}
                employees={employees}
              />
            ) : null}
          </div>
        </div>

        <div className="mt-8 space-y-8">
          {sectionsWithTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Разделов пока нет.</p>
          ) : (
            sectionsWithTasks.map(({ section, tasksWithComments, canManageTasks }) => (
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
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {canChangeStatus ? (
                      <SectionDatesFields
                        sectionId={section.id}
                        startDate={section.startDate}
                        deadline={section.deadline}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {formatSectionDates(section.startDate, section.deadline)}
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
                      />
                    ))}
                  </div>
                )}

                {canManageTasks ? (
                  <TaskDialog
                    mode="create"
                    sectionId={section.id}
                    projectMembers={projectMembers}
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
