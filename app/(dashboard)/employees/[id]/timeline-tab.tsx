import { Bell, History } from "lucide-react";

import type { TimelineItem } from "@/lib/employees/queries";

function formatDateTime(date: Date) {
  return date.toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function TimelineTab({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Пока нет событий.</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={`${item.kind}-${item.id}`} className="flex items-start gap-3 rounded-lg border p-3">
          <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            {item.kind === "activity" ? <History className="size-3.5" /> : <Bell className="size-3.5" />}
          </div>
          <div className="min-w-0 flex-1">
            {item.kind === "activity" ? (
              <p className="text-sm">{item.message}</p>
            ) : (
              <>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.body}</p>
              </>
            )}
            <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
