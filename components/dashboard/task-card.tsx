import { CalendarClock, Pencil } from "lucide-react";
import { TaskStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DepartmentIcon } from "@/components/departments/department-icon";
import { DeleteTaskDialog } from "@/app/(dashboard)/projects/[id]/delete-task-dialog";
import { TaskCommentsDialog } from "@/app/(dashboard)/projects/[id]/task-comments-dialog";
import {
  AssigneeTaskStatusControl,
  ManagerTaskStatusControl,
} from "@/app/(dashboard)/projects/[id]/task-status-control";
import { TaskDialog } from "@/app/(dashboard)/projects/[id]/task-dialog";
import { UserAvatar } from "@/components/ui/user-avatar";
import { TaskChecklist } from "@/components/dashboard/task-checklist";
import type { TaskCommentItem } from "@/lib/comments/queries";
import type { TaskAttachmentItem } from "@/lib/documents/queries";
import type { TaskListItem } from "@/lib/tasks/queries";
import {
  TASK_PRIORITY_BADGE_VARIANT,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_BADGE_VARIANT,
  TASK_STATUS_LABELS,
} from "@/lib/projects/status-labels";

const STATUS_STRIPE: Record<TaskStatus, string> = {
  [TaskStatus.НОВАЯ]: "bg-[#9ca3af]",
  [TaskStatus.В_РАБОТЕ]: "bg-[#2563eb]",
  [TaskStatus.НА_ПРОВЕРКЕ]: "bg-[#e8a030]",
  [TaskStatus.ВЫПОЛНЕНО]: "bg-[#16a34a]",
};

function formatDate(date: Date | null) {
  if (!date) return null;
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

type ProjectMemberOption = { id: string; fullName: string };

export function TaskCard({
  task,
  comments,
  documents,
  currentUserId,
  canManage,
  isAssignee,
  projectMembers,
}: {
  task: TaskListItem;
  comments: TaskCommentItem[];
  documents: TaskAttachmentItem[];
  currentUserId: string | undefined;
  canManage: boolean;
  isAssignee: boolean;
  projectMembers: ProjectMemberOption[];
}) {
  const isOverdue =
    task.deadline !== null && task.deadline < new Date() && task.status !== TaskStatus.ВЫПОЛНЕНО;

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className={`h-1.5 w-full ${STATUS_STRIPE[task.status]}`} />
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium tracking-tight">{task.title}</p>
          {canManage ? (
            <div className="flex shrink-0 items-center gap-0.5">
              <TaskDialog
                mode="edit"
                taskId={task.id}
                projectMembers={projectMembers}
                defaults={{
                  title: task.title,
                  description: task.description,
                  priority: task.priority,
                  deadline: task.deadline,
                  assigneeMemberId: task.assignee?.id ?? null,
                }}
                trigger={
                  <Button variant="ghost" size="icon-sm" title="Редактировать">
                    <Pencil className="size-3.5" />
                  </Button>
                }
              />
              <DeleteTaskDialog taskId={task.id} title={task.title} />
            </div>
          ) : null}
        </div>

        {task.description ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">{task.description}</p>
        ) : null}

        <TaskChecklist items={task.checklistItems} canToggle={canManage || isAssignee} />

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={TASK_STATUS_BADGE_VARIANT[task.status]}>
            {TASK_STATUS_LABELS[task.status]}
          </Badge>
          <Badge variant={TASK_PRIORITY_BADGE_VARIANT[task.priority]}>
            {TASK_PRIORITY_LABELS[task.priority]}
          </Badge>
          {isOverdue ? <Badge variant="destructive">Просрочена</Badge> : null}
          {task.department ? (
            <span
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: task.department.color }}
            >
              <DepartmentIcon name={task.department.icon} className="size-3" />
              {task.department.name}
            </span>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex min-w-0 items-center gap-2">
              {task.assignee ? (
                <>
                  <UserAvatar
                    avatarUrl={task.assignee.avatarUrl}
                    fullName={task.assignee.fullName}
                    seed={task.assignee.userId}
                    size="sm"
                  />
                  <span className="truncate text-xs text-muted-foreground">
                    {task.assignee.fullName}
                  </span>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">Не назначена</span>
              )}
            </div>
            {task.assignedBy ? (
              <span className="truncate text-[11px] text-muted-foreground/70">
                Назначил(а): {task.assignedBy.fullName}
              </span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {task.deadline ? (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarClock className="size-3.5" />
                {formatDate(task.deadline)}
              </div>
            ) : null}
            <TaskCommentsDialog
              taskId={task.id}
              comments={comments}
              documents={documents}
              currentUserId={currentUserId}
              canModerate={canManage}
            />
          </div>
        </div>

        {canManage ? (
          <ManagerTaskStatusControl taskId={task.id} status={task.status} />
        ) : isAssignee ? (
          <AssigneeTaskStatusControl taskId={task.id} status={task.status} />
        ) : null}
      </div>
    </Card>
  );
}
