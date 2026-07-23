export type WorkloadLevel = "low" | "medium" | "high";

// Задач (Task) в продукте пока нет — единственный реальный сигнал нагрузки
// сегодня это количество проектов "в работе", где сотрудник состоит
// участником. Пороги — условные, поправить легко, когда появится учёт задач.
// Общий модуль: используется и на дашборде (WorkloadBoard), и на
// странице сотрудников (EmployeeCard) — одно и то же понятие должно
// считаться и раскрашиваться одинаково в обоих местах.
const WORKLOAD_THRESHOLDS = { medium: 2, high: 4 } as const;

export function workloadLevel(activeProjectsCount: number): WorkloadLevel {
  if (activeProjectsCount >= WORKLOAD_THRESHOLDS.high) return "high";
  if (activeProjectsCount >= WORKLOAD_THRESHOLDS.medium) return "medium";
  return "low";
}

// Цвета — из зарезервированной статусной палитры (good/warning/critical),
// не категориальной: это состояние, а не идентичность серии.
export const WORKLOAD_META: Record<WorkloadLevel, { label: string; color: string }> = {
  low: { label: "Свободен", color: "#0ca30c" },
  medium: { label: "Средняя загрузка", color: "#fab219" },
  high: { label: "Перегружен", color: "#d03b3b" },
};

export const WORKLOAD_NONE_COLOR = "#c3c2b7";

// Задачная загруженность (Phase 16, D15) — отдельная мера от
// workloadLevel выше: считает АКТИВНЫЕ (не ВЫПОЛНЕНО) задачи конкретного
// сотрудника, а не количество проектов. Используется ТОЛЬКО в профиле
// сотрудника (карточка "Загрузка по задачам", рядом с существующей
// "Загрузка по проектам") — WorkloadBoard на дашбордах админа/руководителя
// департамента продолжает использовать project-based workloadLevel, чтобы
// не поменять там смысл незаметно. Пороги условные, поправить легко.
const TASK_WORKLOAD_THRESHOLDS = { medium: 3, high: 6 } as const;

export function taskWorkloadLevel(activeTaskCount: number): WorkloadLevel {
  if (activeTaskCount >= TASK_WORKLOAD_THRESHOLDS.high) return "high";
  if (activeTaskCount >= TASK_WORKLOAD_THRESHOLDS.medium) return "medium";
  return "low";
}
