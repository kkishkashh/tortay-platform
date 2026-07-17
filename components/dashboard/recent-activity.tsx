import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import type { ActivityItem } from "@/lib/dashboard/queries";

// Компактный относительный формат ("5 мин назад") — события в этой ленте
// почти всегда свежие, абсолютная дата для них менее наглядна.
function formatRelativeTime(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) return "только что";
  if (diffMinutes < 60) return `${diffMinutes} мин назад`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} ч назад`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "вчера";
  if (diffDays < 7) return `${diffDays} дн назад`;

  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

export function RecentActivity({ items }: { items: ActivityItem[] }) {
  return (
    <DashboardPanel title="Последние события">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Событий пока нет.</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item) => (
            <li key={item.id} className="text-sm">
              <p>{item.message}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatRelativeTime(item.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </DashboardPanel>
  );
}
