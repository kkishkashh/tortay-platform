import { DEFAULT_DEPARTMENT_ICON, DEPARTMENT_ICONS } from "@/lib/departments/icons";

// Прямой доступ по ключу объекта (как item.icon в sidebar.tsx), а не вызов
// функции-резолвера — react-hooks/static-components (react-compiler) не
// разрешает присваивать результат вызова функции в переменную, которая
// затем используется как JSX-тег, даже если по факту это стабильный выбор
// из фиксированной карты, а не создание нового компонента.
export function DepartmentIcon({ name, className }: { name: string; className?: string }) {
  const Icon = DEPARTMENT_ICONS[name] ?? DEPARTMENT_ICONS[DEFAULT_DEPARTMENT_ICON];
  return <Icon className={className} />;
}
