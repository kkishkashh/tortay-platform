import { CalendarClock } from "lucide-react";
import { TaskStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { PersonalTaskItem } from "@/lib/personal-tasks/queries";
import {
  TASK_PRIORITY_BADGE_VARIANT,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_BADGE_VARIANT,
  TASK_STATUS_LABELS,
} from "@/lib/projects/status-labels";

import { DeletePersonalTaskDialog } from "./delete-personal-task-dialog";
import { PersonalTaskStatusControl } from "./personal-task-status-control";

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

export function PersonalTaskCard({ task }: { task: PersonalTaskItem }) {
  const isOverdue =
    task.deadline !== null && task.deadline < new Date() && task.status !== TaskStatus.ВЫПОЛНЕНО;

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className={`h-1.5 w-full ${STATUS_STRIPE[task.status]}`} />
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium tracking-tight">{task.title}</p>
          <DeletePersonalTaskDialog taskId={task.id} title={task.title} />
        </div>

        {task.description ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">{task.description}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={TASK_STATUS_BADGE_VARIANT[task.status]}>
            {TASK_STATUS_LABELS[task.status]}
          </Badge>
          <Badge variant={TASK_PRIORITY_BADGE_VARIANT[task.priority]}>
            {TASK_PRIORITY_LABELS[task.priority]}
          </Badge>
          {isOverdue ? <Badge variant="destructive">Просрочена</Badge> : null}
        </div>

        {task.deadline ? (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarClock className="size-3.5" />
            {formatDate(task.deadline)}
          </div>
        ) : null}

        <PersonalTaskStatusControl taskId={task.id} status={task.status} />
      </div>
    </Card>
  );
}
