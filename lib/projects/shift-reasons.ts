import { ShiftReasonCategory } from "@prisma/client";

// Источник: прототип ProjecTeam департамента Архитектуры (2026-07-30) —
// деление причин сдвига на внешние (срок "съел" не проектировщик — можно
// предъявить Заказчику при обсуждении переноса) и внутренние (в т.ч.
// "творческая проработка": поиск решения — это работа, а не простой).
// Общий для всей компании справочник, не только для Архитектуры.
export const SHIFT_REASON_META: Record<
  ShiftReasonCategory,
  { label: string; external: boolean; color: string }
> = {
  [ShiftReasonCategory.ПРАВКИ_ЗАКАЗЧИКА]: { label: "Правки Заказчика", external: true, color: "#E8A030" },
  [ShiftReasonCategory.ИЗМЕНЕНИЕ_ПРОГРАММЫ]: {
    label: "Изменение функциональной программы",
    external: true,
    color: "#C88020",
  },
  [ShiftReasonCategory.НЕТ_ИСХОДНЫХ_ДАННЫХ]: {
    label: "Нет исходных данных / ТУ / ГПЗУ",
    external: true,
    color: "#8B5CF6",
  },
  [ShiftReasonCategory.ЗАМЕЧАНИЯ_ЭКСПЕРТИЗЫ]: { label: "Замечания экспертизы", external: true, color: "#3B7DD8" },
  [ShiftReasonCategory.СОГЛАСОВАНИЕ_ГОСОРГАНОВ]: {
    label: "Согласование госорганов",
    external: true,
    color: "#1DB870",
  },
  [ShiftReasonCategory.СМЕЖНИКИ_СУБПОДРЯД]: { label: "Смежники / субподряд", external: true, color: "#96A3B8" },
  [ShiftReasonCategory.ТВОРЧЕСКАЯ_ПРОРАБОТКА]: {
    label: "Творческая проработка (поиск решения)",
    external: false,
    color: "#7440E0",
  },
  [ShiftReasonCategory.ВНУТРЕННИЕ_ПРИЧИНЫ]: { label: "Внутренние причины команды", external: false, color: "#E84040" },
};

export const SHIFT_REASON_ORDER: ShiftReasonCategory[] = [
  ShiftReasonCategory.ПРАВКИ_ЗАКАЗЧИКА,
  ShiftReasonCategory.ИЗМЕНЕНИЕ_ПРОГРАММЫ,
  ShiftReasonCategory.НЕТ_ИСХОДНЫХ_ДАННЫХ,
  ShiftReasonCategory.ЗАМЕЧАНИЯ_ЭКСПЕРТИЗЫ,
  ShiftReasonCategory.СОГЛАСОВАНИЕ_ГОСОРГАНОВ,
  ShiftReasonCategory.СМЕЖНИКИ_СУБПОДРЯД,
  ShiftReasonCategory.ТВОРЧЕСКАЯ_ПРОРАБОТКА,
  ShiftReasonCategory.ВНУТРЕННИЕ_ПРИЧИНЫ,
];
