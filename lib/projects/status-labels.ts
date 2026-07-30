import { ProjectStatus, SectionStatus, TaskPriority, TaskStatus } from "@prisma/client";

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  [ProjectStatus.В_РАБОТЕ]: "В работе",
  [ProjectStatus.ЗАВЕРШЁН_ПО_РАЗДЕЛАМ]: "Завершён по разделам",
  [ProjectStatus.ЗАВЕРШЁН_ПОЛНОСТЬЮ]: "Завершён полностью",
};

// Та же статусная палитра, что и в projects-explorer.tsx (STATUS_META) —
// вынесена сюда, чтобы не дублировать в других местах, где нужен цвет
// статуса проекта (см. employees/[id]/page.tsx). "В работе" — фирменный
// золотой (активное, не тревожное состояние), не отдельный статусный цвет.
export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  [ProjectStatus.В_РАБОТЕ]: "var(--primary)",
  [ProjectStatus.ЗАВЕРШЁН_ПО_РАЗДЕЛАМ]: "#fab219",
  [ProjectStatus.ЗАВЕРШЁН_ПОЛНОСТЬЮ]: "#0ca30c",
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

// Те же 4 цвета, что и в TASK_PRIORITY_BADGE_VARIANT, но как сплошной
// bg-* класс — для маленьких точек-индикаторов в календаре (см.
// app/(dashboard)/calendar/page.tsx), где полупрозрачный фон бейджа
// слишком бледный, чтобы различать приоритет на мелком элементе.
export const TASK_PRIORITY_DOT_COLOR: Record<TaskPriority, string> = {
  [TaskPriority.НИЗКИЙ]: "bg-muted-foreground",
  [TaskPriority.СРЕДНИЙ]: "bg-info",
  [TaskPriority.ВЫСОКИЙ]: "bg-warning",
  [TaskPriority.СРОЧНЫЙ]: "bg-destructive",
};

// Полные строки класса (а не сборка вида `bg-`.replace(...)) — иначе
// Tailwind не увидит их при статическом анализе исходников и не сгенерирует.
export const TASK_PRIORITY_BORDER_COLOR: Record<TaskPriority, string> = {
  [TaskPriority.НИЗКИЙ]: "border-l-muted-foreground",
  [TaskPriority.СРЕДНИЙ]: "border-l-info",
  [TaskPriority.ВЫСОКИЙ]: "border-l-warning",
  [TaskPriority.СРОЧНЫЙ]: "border-l-destructive",
};
