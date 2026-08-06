import { TaskCard } from "@/components/dashboard/task-card";
import type { TaskCommentItem } from "@/lib/comments/queries";
import type { TaskAttachmentItem } from "@/lib/documents/queries";
import type { MyTaskItem } from "@/lib/tasks/queries";

type EmployeeOption = { id: string; fullName: string };

export function TasksTab({
  tasks,
  commentsByTask,
  documentsByTask,
  assignableEmployees,
  currentUserId,
  canManageByTask,
}: {
  tasks: MyTaskItem[];
  commentsByTask: Map<string, TaskCommentItem[]>;
  documentsByTask: Map<string, TaskAttachmentItem[]>;
  assignableEmployees: EmployeeOption[];
  currentUserId: string | undefined;
  canManageByTask: Map<string, boolean>;
}) {
  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">Задач пока нет.</p>;
  }

  const grouped = new Map<string, { projectName: string; tasks: MyTaskItem[] }>();
  for (const task of tasks) {
    const entry = grouped.get(task.projectId) ?? { projectName: task.projectName, tasks: [] };
    entry.tasks.push(task);
    grouped.set(task.projectId, entry);
  }

  return (
    <div className="space-y-6">
      {Array.from(grouped.entries()).map(([projectId, group]) => (
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
                currentUserId={currentUserId}
                canManage={canManageByTask.get(task.id) ?? false}
                isAssignee={task.assignee?.userId === currentUserId}
                assignableEmployees={assignableEmployees}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
