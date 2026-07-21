import { ProjectStatus, SectionStatus, TaskPriority, TaskStatus } from "@prisma/client";

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  [ProjectStatus.В_РАБОТЕ]: "В работе",
  [ProjectStatus.ЗАВЕРШЁН_ПО_РАЗДЕЛАМ]: "Завершён по разделам",
  [ProjectStatus.ЗАВЕРШЁН_ПОЛНОСТЬЮ]: "Завершён полностью",
};

export const SECTION_STATUS_LABELS: Record<SectionStatus, string> = {
  [SectionStatus.В_РАБОТЕ]: "В работе",
  [SectionStatus.ВЫПОЛНЕНО]: "Выполнено",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  [TaskStatus.НОВАЯ]: "Не начата",
  [TaskStatus.В_РАБОТЕ]: "В работе",
  [TaskStatus.НА_ПРОВЕРКЕ]: "На проверке",
  [TaskStatus.ВЫПОЛНЕНО]: "Выполнено",
};

// Gray/Blue/Orange/Green по брифу.
export const TASK_STATUS_BADGE_VARIANT: Record<
  TaskStatus,
  "secondary" | "info" | "warning" | "success"
> = {
  [TaskStatus.НОВАЯ]: "secondary",
  [TaskStatus.В_РАБОТЕ]: "info",
  [TaskStatus.НА_ПРОВЕРКЕ]: "warning",
  [TaskStatus.ВЫПОЛНЕНО]: "success",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  [TaskPriority.НИЗКИЙ]: "Низкий",
  [TaskPriority.СРЕДНИЙ]: "Средний",
  [TaskPriority.ВЫСОКИЙ]: "Высокий",
  [TaskPriority.СРОЧНЫЙ]: "Срочный",
};

export const TASK_PRIORITY_BADGE_VARIANT: Record<
  TaskPriority,
  "secondary" | "info" | "warning" | "destructive"
> = {
  [TaskPriority.НИЗКИЙ]: "secondary",
  [TaskPriority.СРЕДНИЙ]: "info",
  [TaskPriority.ВЫСОКИЙ]: "warning",
  [TaskPriority.СРОЧНЫЙ]: "destructive",
};
