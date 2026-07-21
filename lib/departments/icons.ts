import {
  Building2,
  Cable,
  Calculator,
  ClipboardList,
  Compass,
  Construction,
  Cpu,
  Droplets,
  Factory,
  FlameKindling,
  Hammer,
  HardHat,
  Home,
  Layers,
  Mountain,
  PaintBucket,
  Palette,
  Radio,
  Ruler,
  Server,
  Shield,
  Thermometer,
  TreePine,
  Users,
  Wind,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

// Фиксированный список — иконка департамента выбирается из этого набора,
// а не через произвольную строку/eval. Имя (ключ) хранится в
// Department.icon, резолвится через эту карту при отрисовке.
export const DEPARTMENT_ICONS: Record<string, LucideIcon> = {
  Building2,
  HardHat,
  Droplets,
  Wind,
  Zap,
  Cable,
  FlameKindling,
  Calculator,
  Users,
  Wrench,
  Hammer,
  Ruler,
  Compass,
  Layers,
  Shield,
  Thermometer,
  Radio,
  Server,
  Cpu,
  PaintBucket,
  Palette,
  TreePine,
  Mountain,
  Home,
  Factory,
  Construction,
  ClipboardList,
};

export const DEPARTMENT_ICON_NAMES = Object.keys(DEPARTMENT_ICONS);

export const DEFAULT_DEPARTMENT_ICON = "Building2";

// Фиксированная палитра для быстрого выбора цвета департамента (не
// ограничивает — можно ввести и произвольный hex, см. диалоги создания/
// редактирования), но даёт согласованный набор различимых цветов по
// умолчанию, в духе AVATAR_PALETTE из lib/utils.ts.
export const DEPARTMENT_COLOR_SWATCHES = [
  "#7c3aed",
  "#2563eb",
  "#0891b2",
  "#d97a06",
  "#db2777",
  "#159c46",
  "#dc3b3b",
  "#0d9488",
  "#4a3aa7",
  "#eb6834",
  "#1baf7a",
  "#e34948",
];

export const DEFAULT_DEPARTMENT_COLOR = DEPARTMENT_COLOR_SWATCHES[0];
