import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTenge(amount: number) {
  return `${amount.toLocaleString("ru-RU")} ₸`
}

export function pluralizeProjects(count: number) {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return "проект"
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return "проекта"
  return "проектов"
}

export function pluralizeEmployees(count: number) {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return "сотрудник"
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return "сотрудника"
  return "сотрудников"
}

// Реальные ФИО в базе — "Фамилия Имя Отчество" (Абдикамитов Абзал
// Дауренович) или "Фамилия Имя" без отчества (Мамасерикова Гульнар) —
// поэтому имя это ВТОРОЕ слово, не первое. Если слово всего одно —
// возвращаем его как есть (лучше, чем ничего).
export function getFirstName(fullName: string) {
  const words = fullName.trim().split(/\s+/)
  return words[1] ?? words[0] ?? fullName
}

export function getInitials(fullName: string) {
  // Берём буквенные "слова", а не куски по пробелу — иначе в названиях
  // организаций вроде ТОО "ГеоПроект" вторым символом попадает кавычка.
  const words = fullName.match(/\p{L}+/gu) ?? []
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
}

// Фиксированная категориальная палитра (8 провалидированных на
// различимость цветов) — цвет аватара стабильно вычисляется по id
// сотрудника ("случайный, но всегда один и тот же"), а не хранится в БД.
const AVATAR_PALETTE = [
  "#2a78d6", "#008300", "#e87ba4", "#eda100",
  "#1baf7a", "#eb6834", "#4a3aa7", "#e34948",
]

export function getAvatarColor(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length]
}

// Строится на сервере при каждом заходе на страницу — дата и день недели
// всегда актуальны, без хардкода и без клиентского таймера.
export function formatTodayLabel(date: Date) {
  const weekday = date.toLocaleDateString("ru-RU", { weekday: "long" })
  const rest = date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${rest}`
}
