// ISO-неделя (вида "2026-W31") — считаем на сервере, а не полагаемся на
// часовой пояс браузера, чтобы "Пульс недели" (см. lib/pulse/queries.ts)
// у всех пользователей всегда указывал на одну и ту же неделю.
export function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // Пн=0 ... Вс=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // четверг этой недели
  const year = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayDiff = (d.getTime() - jan4.getTime()) / 86400000;
  const week = 1 + Math.round((dayDiff - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function currentIsoWeek(): string {
  return isoWeek(new Date());
}

const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

// "23 июл — 27 июл" — понедельник-пятница той недели.
export function weekLabel(week: string): string {
  const [yearStr, weekStr] = week.split("-W");
  const year = Number(yearStr);
  const weekNum = Number(weekStr);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = (jan4.getUTCDay() + 6) % 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - jan4Day + (weekNum - 1) * 7);
  const friday = new Date(monday);
  friday.setUTCDate(monday.getUTCDate() + 4);
  return `${monday.getUTCDate()} ${MONTHS[monday.getUTCMonth()]} — ${friday.getUTCDate()} ${MONTHS[friday.getUTCMonth()]}`;
}
