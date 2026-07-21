"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/lib/notifications/actions";
import type { NotificationListItem } from "@/lib/notifications/queries";
import { cn } from "@/lib/utils";

function formatRelativeTime(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "только что";
  if (diffMin < 60) return `${diffMin} мин назад`;
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `${diffHours} ч назад`;
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

export function NotificationBell({
  notifications,
  unreadCount,
  collapsed,
}: {
  notifications: NotificationListItem[];
  unreadCount: number;
  collapsed?: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function handleMarkAllRead() {
    startTransition(() => {
      markAllNotificationsReadAction();
    });
  }

  function handleItemClick(notificationId: string, isRead: boolean) {
    if (isRead) return;
    startTransition(() => {
      markNotificationReadAction(notificationId);
    });
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              "relative flex size-8 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/70 transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              collapsed && "mx-auto",
            )}
            title="Уведомления"
          />
        }
      >
        <Bell className="size-4" />
        {unreadCount > 0 ? (
          <span className="absolute top-1 right-1 flex size-3.5 items-center justify-center rounded-full bg-destructive text-[9px] font-semibold text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <PopoverHeader className="flex-row items-center justify-between px-3 pt-3">
          <PopoverTitle>Уведомления</PopoverTitle>
          {unreadCount > 0 ? (
            <Button
              variant="ghost"
              size="xs"
              onClick={handleMarkAllRead}
              disabled={isPending}
            >
              <CheckCheck className="size-3.5" />
              Прочитать все
            </Button>
          ) : null}
        </PopoverHeader>

        <div className="max-h-80 overflow-y-auto px-1 pb-1">
          {notifications.length === 0 ? (
            <p className="px-2.5 py-4 text-center text-xs text-muted-foreground">
              Уведомлений пока нет
            </p>
          ) : (
            notifications.map((n) => {
              const content = (
                <div
                  className={cn(
                    "flex flex-col gap-0.5 rounded-md px-2.5 py-2 text-xs transition-colors hover:bg-muted",
                    !n.isRead && "bg-primary/5",
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    {!n.isRead ? <span className="size-1.5 shrink-0 rounded-full bg-primary" /> : null}
                    <span className="font-medium">{n.title}</span>
                  </div>
                  <p className="text-muted-foreground">{n.body}</p>
                  <span className="text-[10px] text-muted-foreground/70">
                    {formatRelativeTime(n.createdAt)}
                  </span>
                </div>
              );

              return n.projectId ? (
                <Link
                  key={n.id}
                  href={`/projects/${n.projectId}`}
                  onClick={() => handleItemClick(n.id, n.isRead)}
                  className="block"
                >
                  {content}
                </Link>
              ) : (
                <div key={n.id} onClick={() => handleItemClick(n.id, n.isRead)}>
                  {content}
                </div>
              );
            })
          )}
        </div>

        <div className="border-t p-1.5">
          <Link
            href="/notifications"
            className="block rounded-md px-2.5 py-1.5 text-center text-xs font-medium text-primary hover:bg-muted"
          >
            Все уведомления
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
