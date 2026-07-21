import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SystemRole } from "@prisma/client";

import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/dashboard/stat-card";
import { getCommentsForAssignee, getCommentsForTask } from "@/lib/comments/queries";
import { getDocumentsForTask } from "@/lib/documents/queries";
import { getEmployeeProfile } from "@/lib/employees/queries";
import { getProjectMembersForTaskAssignment } from "@/lib/projects/queries";
import { PROJECT_STATUS_LABELS } from "@/lib/projects/status-labels";
import { canManageProjectTasks } from "@/lib/tasks/permissions";
import { getTasksForUser } from "@/lib/tasks/queries";
import { UserAvatar } from "@/components/ui/user-avatar";
import { WORKLOAD_META } from "@/lib/workload";
import { FolderKanban, ListChecks, Percent, Gauge } from "lucide-react";

import { ContactForm } from "@/components/employees/contact-form";
import { DetailsForm } from "@/components/employees/details-form";
import { PasswordForm } from "@/components/employees/password-form";

import { CommentsTab } from "./comments-tab";
import { DeleteEmployeeDialog } from "./delete-employee-dialog";
import { TasksTab } from "./tasks-tab";

const SYSTEM_ROLE_LABELS = {
  РУКОВОДИТЕЛЬ: "Руководитель",
  СОТРУДНИК: "Сотрудник",
} as const;

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [session, employee] = await Promise.all([auth(), getEmployeeProfile(id)]);
  if (!employee) {
    notFound();
  }

  const isSelf = session?.user.id === employee.id;
  const isHead = session?.user.systemRole === SystemRole.РУКОВОДИТЕЛЬ;
  // Личный кабинет — только свой или (для руководителя) любой чужой.
  if (!isSelf && !isHead) {
    redirect("/employees");
  }

  const canEditContact = isSelf || isHead;
  const canEditDetails = isHead;
  const workloadMeta = WORKLOAD_META[employee.workload];

  const [tasks, comments] = await Promise.all([
    getTasksForUser(employee.id),
    getCommentsForAssignee(employee.id),
  ]);

  const projectIds = Array.from(new Set(tasks.map((t) => t.projectId)));
  const [projectMembersEntries, commentsEntries, documentsEntries] = await Promise.all([
    Promise.all(projectIds.map(async (pid) => [pid, await getProjectMembersForTaskAssignment(pid)] as const)),
    Promise.all(tasks.map(async (t) => [t.id, await getCommentsForTask(t.id)] as const)),
    Promise.all(tasks.map(async (t) => [t.id, await getDocumentsForTask(t.id)] as const)),
  ]);
  const projectMembersByProject = new Map(projectMembersEntries);
  const commentsByTask = new Map(commentsEntries);
  const documentsByTask = new Map(documentsEntries);

  const canManageByTask = new Map(
    tasks.map((task) => [
      task.id,
      session?.user
        ? canManageProjectTasks(session.user, { department: { managerId: task.departmentManagerId } })
        : false,
    ]),
  );

  return (
    <>
      <PageHeader
        title={employee.fullName}
        action={
          isHead && !isSelf ? (
            <DeleteEmployeeDialog userId={employee.id} fullName={employee.fullName} />
          ) : undefined
        }
      />
      <div className="space-y-6 p-8">
        <div className="flex items-center gap-4">
          <UserAvatar
            avatarUrl={employee.avatarUrl}
            fullName={employee.fullName}
            seed={employee.id}
            size="lg"
          />
          <div>
            <p className="text-lg font-medium">{employee.fullName}</p>
            <p className="text-sm text-muted-foreground">
              {employee.position ?? "Должность не указана"} ·{" "}
              {SYSTEM_ROLE_LABELS[employee.systemRole]}
            </p>
          </div>
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Обзор</TabsTrigger>
            <TabsTrigger value="tasks">Проекты и задачи</TabsTrigger>
            <TabsTrigger value="comments">Комментарии</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Активных проектов"
                value={String(employee.activeProjectsCount)}
                icon={FolderKanban}
              />
              <StatCard
                label="Всего проектов"
                value={String(employee.totalProjectsCount)}
                icon={ListChecks}
              />
              <StatCard
                label="Завершено"
                value={`${employee.completionRate}%`}
                icon={Percent}
              />
              <StatCard label="Загруженность" value={workloadMeta.label} icon={Gauge} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Проекты</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {employee.totalProjectsCount === 0 ? (
                  <p className="text-sm text-muted-foreground">Пока нет проектов.</p>
                ) : (
                  employee.projectsByStatus.map(({ status, projects }) =>
                    projects.length === 0 ? null : (
                      <div key={status}>
                        <p className="mb-2 text-xs font-medium text-muted-foreground uppercase">
                          {PROJECT_STATUS_LABELS[status]}
                        </p>
                        <ul className="space-y-1">
                          {projects.map((project) => (
                            <li key={project.id}>
                              <Link
                                href={`/projects/${project.id}`}
                                className="text-sm text-primary hover:underline"
                              >
                                {project.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ),
                  )
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Личные данные</CardTitle>
              </CardHeader>
              <CardContent>
                {canEditContact ? (
                  <ContactForm userId={employee.id} email={employee.email} phone={employee.phone} />
                ) : (
                  <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-muted-foreground">Email</dt>
                      <dd className="text-sm">{employee.email}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Телефон</dt>
                      <dd className="text-sm">{employee.phone ?? "—"}</dd>
                    </div>
                  </dl>
                )}
              </CardContent>
            </Card>

            {canEditDetails ? (
              <Card>
                <CardHeader>
                  <CardTitle>Кадровые данные</CardTitle>
                </CardHeader>
                <CardContent>
                  <DetailsForm
                    userId={employee.id}
                    fullName={employee.fullName}
                    position={employee.position}
                    birthDate={employee.birthDate}
                    salary={employee.salary}
                    systemRole={employee.systemRole}
                  />
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Кадровые данные</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-muted-foreground">Должность</dt>
                      <dd className="text-sm">{employee.position ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Дата рождения</dt>
                      <dd className="text-sm">
                        {employee.birthDate
                          ? employee.birthDate.toLocaleDateString("ru-RU")
                          : "—"}
                      </dd>
                    </div>
                    {isSelf && employee.salary !== null ? (
                      <div>
                        <dt className="text-xs text-muted-foreground">Оклад</dt>
                        <dd className="text-sm">{employee.salary.toLocaleString("ru-RU")} ₸</dd>
                      </div>
                    ) : null}
                  </dl>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>{isSelf ? "Смена пароля" : "Сброс пароля"}</CardTitle>
              </CardHeader>
              <CardContent>
                <PasswordForm userId={employee.id} isSelf={Boolean(isSelf)} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tasks" className="mt-4">
            <TasksTab
              tasks={tasks}
              commentsByTask={commentsByTask}
              documentsByTask={documentsByTask}
              projectMembersByProject={projectMembersByProject}
              currentUserId={session?.user?.id}
              canManageByTask={canManageByTask}
            />
          </TabsContent>

          <TabsContent value="comments" className="mt-4">
            <CommentsTab comments={comments} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
