import { TaskStatus } from "@prisma/client";

// Весовой прогресс раздела (Phase 2 архитектурного дашборда, 2026-07-30,
// из прототипа ProjecTeam) — считается на лету из задач раздела, нигде не
// хранится (заменяет ранее неиспользовавшееся Section.completionPercent).
// null означает "нет задач вообще" — раздел без задач не 0% и не 100%,
// просто нечего показывать.
export function computeWeightedProgress(tasks: { status: TaskStatus; weight: number }[]): number | null {
  if (tasks.length === 0) return null;
  const totalWeight = tasks.reduce((sum, task) => sum + task.weight, 0);
  if (totalWeight <= 0) return null;
  const doneWeight = tasks
    .filter((task) => task.status === TaskStatus.ВЫПОЛНЕНО)
    .reduce((sum, task) => sum + task.weight, 0);
  return Math.round((doneWeight / totalWeight) * 100);
}
