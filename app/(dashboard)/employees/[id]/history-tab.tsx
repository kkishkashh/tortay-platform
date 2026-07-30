import Link from "next/link";
import { TaskStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import type { MyTaskItem } from "@/lib/tasks/queries";
import { TASK_STATUS_BADGE_VARIANT, TASK_STATUS_LABELS } from "@/lib/projects/status-labels";

function formatDate(date: Date | null) {
  if (!date) return "—";
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
}

// Task 4.2 (PRD #3 Phase 3) — задачи никогда не удаляются автоматически
// (только вручную, с блокировками), поэтому это чисто UI-фильтр
// существующих tasks, без изменений в схеме: выполненные и просроченные.
export function HistoryTab({ tasks }: { tasks: MyTaskItem[] }) {
  const now = new Date();
  const historyTasks = tasks
    .filter(
      (task) =>
        task.status === TaskStatus.ВЫПОЛНЕНО || (task.deadline !== null && task.deadline < now),
    )
    .sort((a, b) => (b.deadline?.getTime() ?? 0) - (a.deadline?.getTime() ?? 0));

  if (historyTasks.length === 0) {
    return <p className="text-sm text-muted-foreground">Пока нет выполненных или просроченных задач.</p>;
  }

  return (
    <div className="space-y-2">
      {historyTasks.map((task) => (
        <Link
          key={task.id}
          href={`/projects/${task.projectId}`}
          className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors duration-150 hover:bg-muted/50"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{task.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {task.projectName} · {task.sectionName}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs text-muted-foreground">{formatDate(task.deadline)}</span>
            <Badge variant={TASK_STATUS_BADGE_VARIANT[task.status]}>
              {TASK_STATUS_LABELS[task.status]}
            </Badge>
          </div>
        </Link>
      ))}
    </div>
  );
}
