import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { TaskCard } from "@/components/dashboard/task-card";
import { getCommentsForTasksBatch } from "@/lib/comments/queries";
import { getDocumentsForTasksBatch } from "@/lib/documents/queries";
import { getEmployeesForSelect } from "@/lib/employees/queries";
import { getMyPersonalTasks } from "@/lib/personal-tasks/queries";
import { canManageProjectTasks } from "@/lib/tasks/permissions";
import { getMyTasks } from "@/lib/tasks/queries";
import { formatTodayLabel } from "@/lib/utils";

import { NewPersonalTaskDialog } from "./new-personal-task-dialog";
import { PersonalTaskCard } from "./personal-task-card";

export default async function MyTasksPage() {
  const [session, tasks, personalTasks] = await Promise.all([
    auth(),
    getMyTasks(),
    getMyPersonalTasks(),
  ]);

  // Пакетные запросы (один на все проекты/задачи), а не по одному на
  // каждый — раньше N+1 запросов к Neon подряд были причиной долгой
  // загрузки этой страницы (см. lib/comments/queries.ts::getCommentsForTasksBatch).
  const taskIds = tasks.map((t) => t.id);
  const [assignableEmployees, commentsByTask, documentsByTask] = await Promise.all([
    getEmployeesForSelect(),
    getCommentsForTasksBatch(taskIds),
    getDocumentsForTasksBatch(taskIds),
  ]);

  const grouped = new Map<string, { projectName: string; tasks: typeof tasks }>();
  for (const task of tasks) {
    const entry = grouped.get(task.projectId) ?? { projectName: task.projectName, tasks: [] };
    entry.tasks.push(task);
    grouped.set(task.projectId, entry);
  }

  return (
    <>
      <PageHeader
        title="Мои задачи"
        subtitle={formatTodayLabel(new Date())}
        action={<NewPersonalTaskDialog />}
      />
      <div className="space-y-8 p-8">
        {personalTasks.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              Личные задачи
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {personalTasks.map((task) => (
                <PersonalTaskCard key={task.id} task={task} />
              ))}
            </div>
          </div>
        ) : null}

        {tasks.length === 0 && personalTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Вам пока не назначено ни одной задачи.</p>
        ) : tasks.length === 0 ? null : (
          Array.from(grouped.entries()).map(([projectId, group]) => (
            <div key={projectId} className="space-y-3">
              <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                {group.projectName}
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    comments={commentsByTask.get(task.id) ?? []}
                    documents={documentsByTask.get(task.id) ?? []}
                    currentUserId={session?.user.id}
                    canManage={
                      session?.user
                        ? canManageProjectTasks(session.user, {
                            department: {
                              managers: task.departmentManagerIds.map((id) => ({ id })),
                            },
                          })
                        : false
                    }
                    isAssignee
                    assignableEmployees={assignableEmployees}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
