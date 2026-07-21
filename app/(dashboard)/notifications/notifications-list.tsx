"use client";

import { useTransition } from "react";
import Link from "next/link";
import { CheckCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/lib/notifications/actions";
import type { NotificationListItem } from "@/lib/notifications/queries";
import { cn } from "@/lib/utils";

function formatDateTime(date: Date) {
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotificationsList({ notifications }: { notifications: NotificationListItem[] }) {
  const [isPending, startTransition] = useTransition();
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  function handleMarkAllRead() {
    startTransition(() => {
      markAllNotificationsReadAction();
    });
  }

  function handleItemClick(id: string, isRead: boolean) {
    if (isRead) return;
    startTransition(() => {
      markNotificationReadAction(id);
    });
  }

  return (
    <div className="space-y-4">
      {unreadCount > 0 ? (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={handleMarkAllRead} disabled={isPending}>
            <CheckCheck className="size-3.5" />
            Отметить все прочитанными
          </Button>
        </div>
      ) : null}

      <div className="space-y-2">
        {notifications.map((n) => {
          const body = (
            <Card className={cn(!n.isRead && "ring-1 ring-primary/30")} size="sm">
              <CardContent className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    {!n.isRead ? <span className="size-1.5 shrink-0 rounded-full bg-primary" /> : null}
                    <p className="text-sm font-medium">{n.title}</p>
                    {!n.isRead ? <Badge variant="info">Новое</Badge> : null}
                  </div>
                  <p className="text-sm text-muted-foreground">{n.body}</p>
                  <p className="text-xs text-muted-foreground/70">{formatDateTime(n.createdAt)}</p>
                </div>
              </CardContent>
            </Card>
          );

          return n.projectId ? (
            <Link
              key={n.id}
              href={`/projects/${n.projectId}`}
              onClick={() => handleItemClick(n.id, n.isRead)}
              className="block"
            >
              {body}
            </Link>
          ) : (
            <div key={n.id} onClick={() => handleItemClick(n.id, n.isRead)}>
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}
